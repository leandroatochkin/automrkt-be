import { PrismaClient } from "@prisma/client";
import { platformPublishers } from "../platforms";
import { RetryablePlatformError, PermanentPlatformError } from "../errorHandling/errors";

const prisma = new PrismaClient();

const MAX_RETRIES = 3;
const BACKOFF_MINUTES = 5;

export async function runPublishWorker() {
  const now = new Date();

  const job = await prisma.publishJob.findFirst({
        where: {
            status: { in: ["queued", "failed"] },   // note: NOT canceled
            scheduleTime: { lte: now },
            OR: [
            { lastAttempt: null },
            { lastAttempt: { lte: new Date(now - BACKOFF_MINUTES * 60 * 1000) } }
            ]
        },
        include: { campaign: true },
        orderBy: { scheduleTime: "asc" }
        });


  if (!job || job.campaign.status !== "SCHEDULED") return;

  const claimed = await prisma.publishJob.updateMany({
    where: {
        id: job.id,
        status: job.status
    },
    data: { status: "processing", lastAttempt: new Date() }
    });

    if (claimed.count === 0) return;

  await prisma.$transaction([
        prisma.publishJob.update({
            where: { id: job.id },
            data: { status: "processing", lastAttempt: new Date() }
        }),
        prisma.campaign.update({
            where: { id: job.campaignId },
            data: { status: "RUNNING" }
        })
        ]);

  try {
    // simulate publish
    //await new Promise(res => setTimeout(res, 2000));

    // random failure simulation (optional while testing)
    //if (Math.random() < 0.5) throw new Error("Random publish failure");

    const publisher = platformPublishers[job.platform];

    if (!publisher) {
        throw new Error(`No publisher for platform ${job.platform}`);
        }

    await publisher.publish({
        text: job.campaign.content
    });

    await prisma.$transaction([
        prisma.publishJob.update({
            where: { id: job.id },
            data: {
            status: "done",
            logs: {
                ...(job.logs || []),
                message: "Published successfully",
                time: new Date()
            }
            }
        }),
        prisma.campaign.update({
            where: { id: job.campaignId },
            data: { status: "COMPLETED" }
        })
        ]);

  } catch (err) {
        const retries = job.retryCount + 1;

        const isPermanent =
            err instanceof PermanentPlatformError ||
            retries >= MAX_RETRIES;

        if (isPermanent) {
            await prisma.publishJob.update({
            where: { id: job.id },
            data: {
                status: "FAILED_PERMANENT",
                retryCount: retries,
                logs: {
                platform: job.platform,
                message: err.message,
                time: new Date()
                }
            }
            });

        } else if (err instanceof RetryablePlatformError) {
            await prisma.publishJob.update({
            where: { id: job.id },
            data: {
                status: "FAILED",
                retryCount: retries,
                logs: {
                platform: job.platform,
                message: `Retry ${retries}/${MAX_RETRIES}: ${err.message}`,
                time: new Date()
                }
            }
            });

        } else {
            // unknown error → treat as retryable (safe default)
            await prisma.publishJob.update({
            where: { id: job.id },
            data: {
                status: "FAILED",
                retryCount: retries,
                logs: {
                platform: job.platform,
                message: `Unknown error: ${err.message}`,
                time: new Date()
                }
            }
            });
        }
        }

        const remaining = await prisma.publishJob.count({
            where: {
                campaignId: job.campaignId,
                status: { in: ["QUEUED", "PROCESSING", "FAILED"] }
            }
            });

            if (remaining === 0) {
            await prisma.campaign.update({
                where: { id: job.campaignId },
                data: { status: "COMPLETED" }
            });
            }
}
