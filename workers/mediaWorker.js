import { prisma } from "../prisma";
import { imageModel } from "../services/gemini.client";
import { uploadImage } from "../services/storage";

const MAX_RETRIES = 3;

export async function processMediaJob(jobId) {
  const job = await prisma.mediaJob.findUnique({
    where: { id: jobId },
    include: { campaign: true }
  });

  if (!job) return;

  // 🚫 Only queued jobs
  if (job.status !== "QUEUED") return;

  // 🚫 Retry limit
  if (job.retryCount >= MAX_RETRIES) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: "Max retries reached" }
    });
    return;
  }

  // 🔒 Soft lock
  await prisma.mediaJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      retryCount: { increment: 1 },
      lastAttempt: new Date()
    }
  });

  try {
    let assetUrl;

    if (job.type === "IMAGE") {
      assetUrl = await generateImage(job.prompt);
    } else {
      throw new Error(`Unsupported media type: ${job.type}`);
    }

    await prisma.mediaAsset.create({
      data: {
        campaignId: job.campaignId,
        jobId: job.id,
        platform: job.platform,
        type: job.type,
        url: assetUrl,
        prompt: job.prompt
      }
    });

    await prisma.mediaJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        error: null
      }
    });

  } catch (err) {
    console.error("Media job failed:", err);

    await prisma.mediaJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: err.message
      }
    });
  }
}
