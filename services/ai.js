import axios from "axios";

const OLLAMA_CLIENT_ID = process.env.OLLAMA_CLIENT_ID;
const OLLAMA_CLIENT_SECRET = process.env.OLLAMA_CLIENT_SECRET;
const OLLAMA_URL = process.env.OLLAMA_URL;

export async function generateCampaign(input) {
  const prompt = `
Create a marketing campaign in JSON:

Product: ${input.product_name}
Audience: ${input.target_audience}

Return ONLY JSON:
{
  "captions": ["..."],
  "image_prompts": ["..."],
  "video_prompts": ["..."]
}
`;

  const res = await axios.post(
    `${OLLAMA_URL}/api/generate`,
    {
      model: "llama3",
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0 
      }
    },
    {
      headers: {
        "CF-Access-Client-Id": `${OLLAMA_CLIENT_ID}`,
        "CF-Access-Client-Secret": `${OLLAMA_CLIENT_SECRET}`,
        "Content-Type": "application/json"
      }
    }
  );

  return JSON.parse(res.data.response);
}

export async function generateImageWithGemini(prompt) {
  console.log("🖼️ Generating image:", prompt);
  await new Promise(r => setTimeout(r, 1500));
  return `https://fake.cdn/images/${encodeURIComponent(prompt)}.png`;
}

export async function generateVideoWithGemini(prompt) {
  console.log("🎥 Generating video:", prompt);
  await new Promise(r => setTimeout(r, 3000));
  return `https://fake.cdn/videos/${encodeURIComponent(prompt)}.mp4`;
}