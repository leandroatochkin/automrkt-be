import express from "express";
import { PrismaClient } from "@prisma/client";
import { checkToken } from "../middleware/checkToken.js";
import { ensureUser } from "../middleware/ensureUser.js";

const prisma = new PrismaClient();
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { campaignId, scheduleTime } = req.body;

    if (!campaignId || !scheduleTime) {
      return res.status(400).json({
        error: "campaignId and scheduleTime are required"
      });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status !== "DRAFT") {
      return res.status(400).json({
        error: "Campaign already scheduled or locked"
      });
    }

    const scheduledDate = new Date(scheduleTime);

    await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "SCHEDULED",
          scheduledAt: scheduledDate,
          lockedAt: new Date()
        }
      }),
      prisma.publishJob.create({
        data: {
          campaignId,
          scheduleTime: scheduledDate,
          status: "queued"
        }
      })
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to schedule campaign" });
  }
});


router.delete("/:id", async (req, res) => {

  const jobId = req.params.id;

  if(!jobId) { 
    return res.status(400).json({ error: "Invalid job ID" });
  }

  try {

    const job = await prisma.publishJob.findUnique({
      where: { id: jobId },
      include: { campaign: true }
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    // ensure job belongs to logged-in user
    // if (job.campaign.userId !== req.user.id) {
    //   return res.status(403).json({ error: "Not allowed" });
    // }

    // cannot cancel jobs already running or finished
    if (["processing", "done", "failed_permanent"].includes(job.status)) {
      return res
        .status(400)
        .json({ error: "Job cannot be canceled at this stage" });
    }

    const canceled = await prisma.$transaction([
        prisma.publishJob.update({
            where: { id: jobId },
            data: { status: "canceled" }
        }),
        prisma.campaign.update({
            where: { id: job.campaignId },
            data: { status: "CANCELED" }
        })
        ]);


    res.json(canceled);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

export default router;
