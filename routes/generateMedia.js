import express from "express";
import { PrismaClient } from "@prisma/client";
import { processMediaJob } from "../workers/mediaWorker.js";

const prisma = new PrismaClient();
const router = express.Router();

// router.post("/:id", 
//     //checkToken,
//     //ensureUser,
//     async (req, res) => {
//   try {
//     const campaignId = req.params.id;
//     const { platforms = [], types = [] } = req.body;

//     if (!platforms.length || !types.length) {
//       return res.status(400).json({
//         error: "platforms and types are required"
//       });
//     }

//     const campaign = await prisma.campaign.findUnique({
//       where: { id: campaignId },
//       include: {
//         versions: { orderBy: { version: "desc" }, take: 1 },
//         mediaJobs: true
//       }
//     });

//     if (!campaign) {
//       return res.status(404).json({ error: "Campaign not found" });
//     }

//     if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
//       return res.status(400).json({
//         error: "Cannot generate media for running or completed campaigns"
//       });
//     }

//     const version = campaign.versions[0];
//     if (!version) {
//       return res.status(400).json({ error: "Campaign has no content version" });
//     }

//     const { imagePrompts = [], videoPrompts = [] } = version.data;


//     const jobsToCreate = [];

//     for (const platform of platforms) {
//       if (types.includes("IMAGE")) {
//         for (const prompt of imagePrompts) {
//           const exists = campaign.mediaJobs.some(
//             j =>
//               j.platform === platform &&
//               j.type === "IMAGE" &&
//               j.prompt === prompt
//           );

//           if (!exists) {
//             jobsToCreate.push({
//               campaignId,
//               platform,
//               type: "IMAGE",
//               prompt
//             });
//           }
//         }
//       }

//       if (types.includes("VIDEO")) {
//         for (const prompt of videoPrompts) {
//           const exists = campaign.mediaJobs.some(
//             j =>
//               j.platform === platform &&
//               j.type === "VIDEO" &&
//               j.prompt === prompt
//           );

//           if (!exists) {
//             jobsToCreate.push({
//               campaignId,
//               platform,
//               type: "VIDEO",
//               prompt
//             });
//           }
//         }
//       }
//     }

//     if (jobsToCreate.length === 0) {
//       return res.json({ created: 0, message: "No new media jobs created" });
//     }

//     // 3️⃣ Create jobs
//     await prisma.mediaJob.createMany({
//       data: jobsToCreate
//     });

//     res.json({
//       created: jobsToCreate.length,
//       jobs: jobsToCreate
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to create media jobs" });
//   }
// });

router.post("/:id", async (req, res) => {
  const { prompt, type = "IMAGE" } = req.body;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: req.params.id,
      ownerId: req.user.id
    }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const job = await prisma.mediaJob.create({
    data: {
      campaignId: campaign.id,
      prompt,
      type,
      status: "QUEUED"
    }
  });

  // fire and forget (for now)
  processMediaJob(job.id);

  res.status(202).json({
    jobId: job.id,
    status: "QUEUED"
  });
});


export default router;
