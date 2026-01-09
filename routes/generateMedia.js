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
  const { prompt, type = "IMAGE", platform } = req.body;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: req.params.id,
      //ownerId: req.user.id
    }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (!platform) {
    return res.status(400).json({ error: "Platform is required (e.g., INSTAGRAM, TIKTOK)" });
  }

  const job = await prisma.mediaJob.create({
    data: {
      campaignId: campaign.id,
      prompt,
      type,
      platform,
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

router.post(
  "/campaigns/:id/client",
  /* checkToken, */
  /* ensureUser, */
  async (req, res) => {
    try {
      const campaignId = req.params.id;
      //const userId = req.user.id;

      const {
        provider,
        type,
        platform,
        url,
        prompt,
        fileSize,
        mimeType
      } = req.body;

      // ─────────────────────────────
      // Basic validation
      // ─────────────────────────────
      if (!provider || !type || !url || !fileSize || !mimeType) {
        return res.status(400).json({
          error: "Missing required fields"
        });
      }

      // ─────────────────────────────
      // Provider lock (PUTER only)
      // ─────────────────────────────
      if (provider !== "PUTER") {
        return res.status(400).json({
          error: "Only PUTER-generated assets are allowed"
        });
      }

      // ─────────────────────────────
      // Media type lock
      // ─────────────────────────────
      if (type !== "IMAGE") {
        return res.status(400).json({
          error: "Only IMAGE assets are allowed"
        });
      }

      // ─────────────────────────────
      // JPG only
      // ─────────────────────────────
      if (!["image/jpeg", "image/jpg"].includes(mimeType)) {
        return res.status(400).json({
          error: "Only JPG images are allowed"
        });
      }

      // ─────────────────────────────
      // File size limit
      // ─────────────────────────────
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          error: "Image exceeds 128KB limit"
        });
      }

      // ─────────────────────────────
      // Ownership check
      // ─────────────────────────────
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          ownerId: "1" //userId
        }
      });

      if (!campaign) {
        return res.status(404).json({
          error: "Campaign not found"
        });
      }

      // ─────────────────────────────
      // Max 3 images per campaign
      // ─────────────────────────────
      const imageCount = await prisma.mediaAsset.count({
        where: {
          campaignId,
          type: "IMAGE"
        }
      });

      if (imageCount >= MAX_IMAGES_PER_CAMPAIGN) {
        return res.status(400).json({
          error: "Image limit reached for this campaign"
        });
      }

      // ─────────────────────────────
      // Moderation flags (default SAFE)
      // ─────────────────────────────
      const moderation = {
        pending: true,
        flagged: false,
        reason: null
      };

      // ─────────────────────────────
      // Create asset
      // ─────────────────────────────
      const asset = await prisma.mediaAsset.create({
        data: {
          campaignId,
          provider: "PUTER",
          type: "IMAGE",
          platform,
          prompt,
          url,

          // moderation
          //moderationStatus: "PENDING",
          //moderationFlags: moderation
        }
      });

      return res.status(201).json(asset);

    } catch (err) {
      console.error(err);
      return res.status(500).json({
        error: "Failed to register media asset"
      });
    }
  }
);


export default router;
