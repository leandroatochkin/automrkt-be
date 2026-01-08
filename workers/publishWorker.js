import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAX_RETRIES = 3;
const BACKOFF_MINUTES = 5;

export async function runPublishWorker() {
  const now = new Date();

  const job = await prisma.publishJob.findFirst({
    where: {
      status: { in: ["queued", "failed"] },
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

  // mark campaign running
  await prisma.campaign.update({
    where: { id: job.campaignId },
    data: { status: "RUNNING" }
  });

  try {
    await new Promise(res => setTimeout(res, 2000));

    await prisma.$transaction([
      prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "done",
          logs: [
            ...(job.logs ?? []),
            { message: "Published successfully", time: new Date() }
          ]
        }
      }),
      prisma.campaign.update({
        where: { id: job.campaignId },
        data: { status: "COMPLETED" }
      })
    ]);

  } catch (err) {
    const retries = job.retryCount + 1;

    if (retries >= MAX_RETRIES) {
      await prisma.$transaction([
        prisma.publishJob.update({
          where: { id: job.id },
          data: {
            status: "failed_permanent",
            retryCount: retries,
            logs: [
              ...(job.logs ?? []),
              { message: `Failed permanently: ${err.message}`, time: new Date() }
            ]
          }
        }),
        prisma.campaign.update({
          where: { id: job.campaignId },
          data: { status: "CANCELED" }
        })
      ]);
    } else {
      await prisma.publishJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          retryCount: retries,
          logs: [
            ...(job.logs ?? []),
            { message: `Retry ${retries}/${MAX_RETRIES} failed`, time: new Date() }
          ]
        }
      });
    }
  }
}

