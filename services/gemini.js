import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateImage(prompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image"
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  });

  const parts = result.response.candidates?.[0]?.content?.parts;

  const imagePart = parts?.find(p => p.inlineData);

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image returned from Gemini");
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
}
