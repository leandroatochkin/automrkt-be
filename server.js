import express from "express";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import generateCampaignRouter from "./routes/generateCampaign.js";
import getCampaignsRouter from "./routes/getCampaigns.js";
import createPublishJobRouter from "./routes/createPublishJob.js";
import { runPublishWorker } from "./workers/publishWorker.js";

dotenv.config();
const prisma = new PrismaClient();
const app = express();

setInterval(runPublishWorker, 60 * 1000);
 
app.use(bodyParser.json());

app.use("/campaigns/generate", generateCampaignRouter);
app.use("/campaign", getCampaignsRouter);
app.use("/publish-job", createPublishJobRouter);

app.get("/", (req, res) => res.json({ status: "ok" }));

app.listen(3000, () => console.log("API running on http://localhost:3000"));
