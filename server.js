import express from "express";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";
import generateCampaignRouter from "./routes/generateCampaign.js";
import getCampaignsRouter from "./routes/getCampaigns.js";
import createPublishJobRouter from "./routes/createPublishJob.js";
import generateMediaRouter from "./routes/generateMedia.js";
import { runPublishWorker } from "./workers/publishWorker.js";
import { runMediaWorker } from "./workers/mediaWorker.js";
import cors from "cors";


dotenv.config();
const prisma = new PrismaClient();
const app = express();

const frontendURLA = process.env.FRONTEND_URL_A;
//const frontendURLB = process.env.FRONTEND_URL_B;
const allowedOrigins = [
    frontendURLA,
    //frontendURLB
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true); // Allow requests with no origin (e.g., mobile apps)
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

setInterval(runPublishWorker, 60 * 1000);
setInterval(runMediaWorker, 3000);

 
app.use(bodyParser.json());


app.use("/campaigns/generate", generateCampaignRouter);
app.use("/campaign", getCampaignsRouter);
app.use("/publish-job", createPublishJobRouter);
app.use("/media/generate", generateMediaRouter);

app.get("/", (req, res) => res.json({ status: "ok" }));

app.listen(3000, () => console.log("API running on http://localhost:3000"));
