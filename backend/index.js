import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import OpenAI from "openai";
import pool from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📄 Parse Resume
async function parseResume(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return data.text.slice(0, 4000); // limit for token safety
}

// 🤖 AI Analysis
async function analyze(resumeText, jdText) {
  const prompt = `
Return ONLY valid JSON in this format:
{
  "fit_score": number,
  "missing_skills": [],
  "suggestions": [],
  "apply": "Yes" | "No",
  "confidence": "Low" | "Medium" | "High"
}

Compare the resume and job description.

Resume:
${resumeText}

Job Description:
${jdText}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}
async function getEmbedding(text) {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
// 🚀 API
app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file || !req.body.jd) {
      return res.status(400).json({ error: "Missing resume or JD" });
    }

    const jd = req.body.jd;

    const resumeText = await parseResume(req.file.path);

    const [resumeEmbedding, jdEmbedding] = await Promise.all([
          getEmbedding(resumeText),
          getEmbedding(jd),
    ]);

    const similarity = cosineSimilarity(resumeEmbedding, jdEmbedding);

    // 🔹 Convert to percentage
    const embeddingScore = Math.round(similarity * 100);

    // 🔹 AI reasoning
    const aiResult = await analyze(resumeText, jd);

    let parsed;

    try {
      parsed = JSON.parse(aiResult);
    } catch (e) {
      console.error("AI response parse failed:", aiResult);
      return res.status(500).json({ error: "Invalid AI response" });
    }

    // 🔹 Combine scores
    const finalScore = Math.round(
      0.6 * embeddingScore + 0.4 * parsed.fit_score
    );
    await pool.query(
      `INSERT INTO analyses 
      (jd, fit_score, embedding_score, apply_decision, confidence)
      VALUES ($1, $2, $3, $4, $5)`,
      [jd, finalScore, embeddingScore, parsed.apply, parsed.confidence]
    );
    res.json({
      fit_score: finalScore,
      apply: parsed.apply,
      confidence: parsed.confidence,
      missing_skills: parsed.missing_skills,
      suggestions: parsed.suggestions,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error processing" });
  }
});

app.post("/simplify-jd", async (req, res) => {
  const { jd } = req.body;

  const prompt = `
Simplify this job description:
- Remove jargon
- Make it concise
- Keep only essential skills

JD:
${jd}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  res.json({ simplified: response.choices[0].message.content });
});

app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM analyses ORDER BY created_at DESC LIMIT 10"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.get("/", (req, res) => {
  res.send("ApplyWise AI Backend Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});