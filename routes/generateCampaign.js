import express from "express";
import { generateCampaign } from "../services/ai.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();

router.post("/", async (req, res) => {
    const { product_name, target_audience, user_id } = req.body;

    if (
        !product_name 
        || !target_audience 
        //|| !user_id
    ) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // 1. Generate the AI content
        const campaignData = await generateCampaign({ product_name, target_audience });

        // 2. Save to database using the correct model fields
        const savedCampaign = await prisma.campaign.create({
            data: {
                name: product_name,           
                content: JSON.stringify(campaignData), 
                audience: {                   
                    target: target_audience 
                },
                owner: {                     
                    connect: { id: user_id || "1" }
                },
        
            }
        });

        res.status(201).json({
            campaignId: savedCampaign.id,
            status: savedCampaign.status,
            content: campaignData
            });
    } catch (error) {
        console.error("Error generating campaign:", error);
        res.status(500).json({ error: "Failed to generate campaign" });
    }
});

export default router;