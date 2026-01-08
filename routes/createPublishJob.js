import express from "express";
import { PrismaClient, JobStatus, PublishPlatform } from "@prisma/client";
import { checkToken } from "../middleware/checkToken.js";
import { ensureUser } from "../middleware/ensureUser.js";

const prisma = new PrismaClient();
const router = express.Router();

router.post(
  "/",
  //checkToken,
  //ensureUser,
  async (req, res) => {
    try {
      const { campaignId, scheduleTime, platforms, userId } = req.body;

      if (!campaignId || !scheduleTime) {
        return res.status(400).json({
          error: "campaignId and scheduleTime are required"
        });
      }
      
      if (!platforms || platforms.length === 0) {
        return res.status(400).json({ error: "At least one platform required" });
        }

      const scheduledDate = new Date(scheduleTime);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: "Invalid scheduleTime" });
      }

      await prisma.$transaction(async (tx) => {
        const locked = await tx.campaign.updateMany({
          where: {
            id: campaignId,
            ownerId: userId || "1",
            status: "DRAFT"
          },
          data: {
            status: "SCHEDULED",
            scheduledAt: scheduledDate,
            lockedAt: new Date()
          }
        });

        if (locked.count === 0) {
          throw new Error("Campaign already scheduled or locked");
        }

        await tx.publishJob.createMany({
            data: platforms.map((platform) => ({
                campaignId,
                scheduleTime: scheduledDate,
                platform: PublishPlatform[platform], // if coming from request
                status: JobStatus.QUEUED
            }))
        });
      });

      res.json({
        success: true,
        status: "SCHEDULED",
        scheduledAt: scheduledDate
      });

    } catch (err) {
      if (err.message.includes("locked")) {
        return res.status(409).json({ error: err.message });
      }

      console.error(err);
      res.status(500).json({ error: "Failed to schedule campaign" });
    }
  }
);

/**
 * Cancel a scheduled campaign/job (atomic)
 */
router.delete(
  "/:jobId",
  //checkToken,
  //ensureUser,
  async (req, res) => {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const canceledJob = await tx.publishJob.updateMany({
          where: {
            id: jobId,
            status: { in: ["queued", "failed"] },
            campaign: {
              ownerId: req.user.id
            }
          },
          data: {
            status: "canceled"
          }
        });

        if (canceledJob.count === 0) {
          throw new Error("Job cannot be canceled");
        }

        await tx.campaign.updateMany({
          where: {
            publishJobs: {
              some: { id: jobId }
            },
            status: "SCHEDULED"
          },
          data: {
            status: "CANCELED"
          }
        });
      });

      res.json({ success: true, status: "CANCELED" });

    } catch (err) {
      if (err.message.includes("cannot be canceled")) {
        return res.status(409).json({ error: err.message });
      }

      console.error(err);
      res.status(500).json({ error: "Failed to cancel job" });
    }
  }
);

export default router;
