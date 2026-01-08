import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(campaigns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

router.get("/single/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!campaign) return res.status(404).json({ error: "Not found" });

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Failed to get campaign" });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, content, audience } = req.body;

  if (!name || !content || !audience || !id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id }
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (campaign.status !== "DRAFT") {
    return res.status(400).json({
      error: "Campaign is locked and cannot be edited"
    });
  }

  const nextVersion = campaign.version + 1;

  const [updatedCampaign] = await prisma.$transaction([
        prisma.campaign.update({
            where: { id },
            data: {
            name,
            content,
            audience,
            version: nextVersion
            }
        }),
        prisma.campaignVersion.create({
            data: {
            campaignId: id,
            version: nextVersion,
            data: {
                name,
                content,
                audience
            },
            editedBy: campaign.ownerId
            }
        })
        ]);



  res.json({
    success: true,
    version: nextVersion,
    campaign: updatedCampaign
  });
});

router.get("/:id/versions", async (req, res) => {
  const { id } = req.params;

  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { version: "desc" }
  });

  res.json(versions);
});

router.get("/:id/status", 
    //checkToken, 
    //ensureUser, 
    async (req, res) => {
  try {
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: req.user.id
      },
      include: {
        publishJobs: {
          orderBy: { platform: "asc" }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
        createdAt: campaign.createdAt
      },
      jobs: campaign.publishJobs.map((job) => ({
        id: job.id,
        platform: job.platform,
        status: job.status,
        retryCount: job.retryCount,
        lastAttempt: job.lastAttempt,
        logs: job.logs
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch campaign status" });
  }
});
export default router;
