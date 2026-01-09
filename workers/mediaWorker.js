// //import { prisma } from "../prisma";
// import { PrismaClient } from "@prisma/client";
// import { generateImage } from "../services/gemini.js";


// const prisma = new PrismaClient();

// const MAX_RETRIES = 3;

// export async function processMediaJob(jobId) {
//   const job = await prisma.mediaJob.findUnique({
//     where: { id: jobId },
//     include: { campaign: true }
//   });

//   if (!job) return;

//   // 🚫 Only queued jobs
//   if (job.status !== "QUEUED") return;

//   // 🚫 Retry limit
//   if (job.retryCount >= MAX_RETRIES) {
//     await prisma.mediaJob.update({
//       where: { id: jobId },
//       data: { status: "FAILED", error: "Max retries reached" }
//     });
//     return;
//   }

//   // 🔒 Soft lock
//   await prisma.mediaJob.update({
//     where: { id: jobId },
//     data: {
//       status: "PROCESSING",
//       retryCount: { increment: 1 },
//       lastAttempt: new Date()
//     }
//   });

//   try {
//     let assetUrl;

//     if (job.type === "IMAGE") {
//       assetUrl = await generateImage(job.prompt);
//     } else {
//       throw new Error(`Unsupported media type: ${job.type}`);
//     }

//     await prisma.mediaAsset.create({
//       data: {
//         campaignId: job.campaignId,
//         jobId: job.id,
//         platform: job.platform,
//         type: job.type,
//         url: assetUrl,
//         prompt: job.prompt
//       }
//     });

//     await prisma.mediaJob.update({
//       where: { id: jobId },
//       data: {
//         status: "COMPLETED",
//         completedAt: new Date(),
//         error: null
//       }
//     });

//   } catch (err) {
//     console.error("Media job failed:", err);

//     await prisma.mediaJob.update({
//       where: { id: jobId },
//       data: {
//         status: "FAILED",
//         lastError: err.message
//       }
//     });
//   }
// }
import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const prisma = new PrismaClient();

export async function processMediaJob(jobId) {
  // 1. Fetch job
  const job = await prisma.mediaJob.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error("Job not found");

  try {
    // 2. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: job.prompt,
    });

    // 3. Extract image
    const part = response.candidates[0].content.parts.find(
      p => p.inlineData
    );

    if (!part?.inlineData?.data) {
      throw new Error("No image returned from Gemini");
    }

    const buffer = Buffer.from(part.inlineData.data, "base64");

    // 4. Save image
    const fileName = `${job.id}.png`;
    const filePath = path.join("uploads", fileName);

    fs.writeFileSync(filePath, buffer);

    // 5. Create Media record
    await prisma.media.create({
      data: {
        campaignId: job.campaignId,
        jobId: job.id,
        type: "IMAGE",
        url: `/uploads/${fileName}`,
      },
    });

    // 6. Mark job done
    await prisma.mediaJob.update({
      where: { id: job.id },
      data: { status: "DONE" },
    });

  } catch (err) {
    await prisma.mediaJob.update({
      where: { id: jobId },
      data: { status: "FAILED" },
    });
    throw err;
  }
}


export async function runMediaWorker() {
  const job = await prisma.mediaJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" }
  });

  if (!job) return;

  await processMediaJob(job.id);
}
