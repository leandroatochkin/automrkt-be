import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const imageModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
});


export async function generateImage(prompt) {
  const result = await imageModel.generateContent([
    { text: prompt }
  ]);

  const imageBase64 =
    result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!imageBase64) {
    throw new Error("No image returned from Gemini");
  }

  return uploadImage(imageBase64);
}

// Later for video:
// model: "gemini-1.5-pro"
