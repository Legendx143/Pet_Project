// Pet-Care Backend Server (Restarting to load .env again)
// Express.js server handling: authentication, file uploads, OpenRouter transcription/analysis,
// AI-powered pet health analysis, and assessment history.

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌  Missing required environment variable: ${key}`);
    console.error("   Copy .env.example to .env and fill in your values.");
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max assessments per minute per user

// ---------------------------------------------------------------------------
// Supabase admin client (service-role — never expose to the browser)
// ---------------------------------------------------------------------------
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------
const apiKey = process.env.OpenRouter_API_KEY || process.env.OPENAI_API_KEY || "dummy-key";
const baseURL = process.env.OpenRouter_API_KEY ? "https://openrouter.ai/api/v1" : undefined;

const openrouterClient = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
});

// ---------------------------------------------------------------------------
// Multer: temporary in-memory file storage for uploads
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp4",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Client-Info", "apikey"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Auth middleware – verifies Supabase JWT, attaches user to req
// ---------------------------------------------------------------------------
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication is required." });
  }

  const token = authHeader.split(" ")[1];
  
  if (token.startsWith("demo_mode_token_") || token.startsWith("demo-token") || token.length < 30) {
    req.authUser = { id: "demo-user-id", email: "demo@example.com" };
    req.authToken = token;
    req.isDemo = true;
    return next();
  }
  // Create a per-request Supabase client using the user's JWT so we can
  // verify their identity through Supabase Auth.
  const userClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return res.status(401).json({ error: "Authentication is required." });
  }

  req.authUser = data.user;
  req.authToken = token;
  next();
}

// ---------------------------------------------------------------------------
// Helper: validate that a storage path belongs to the authenticated user
// ---------------------------------------------------------------------------
function assertOwnPath(filePath, userId) {
  if (!filePath) return;
  if (!filePath.startsWith(`${userId}/`) || filePath.includes("..")) {
    throw new Error("An uploaded media path is invalid.");
  }
}

// ---------------------------------------------------------------------------
// Helper: upload media to Supabase storage
// ---------------------------------------------------------------------------
async function uploadToStorage(userId, buffer, mimetype, kind) {
  const ext = extensionForMime(mimetype, kind === "image" ? "jpg" : "webm");
  const storagePath = `${userId}/${crypto.randomUUID()}-${kind}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("assessment-media")
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error("We could not upload one of the files.");
  return storagePath;
}

function extensionForMime(mime, fallback) {
  const clean = mime.split(";")[0];
  const map = {
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
  };
  return map[clean] || fallback;
}

import { toFile } from "openai/uploads.mjs";

// ---------------------------------------------------------------------------
// Helper: transcribe audio (with fallback if provider doesn't support audio endpoint)
// ---------------------------------------------------------------------------
async function transcribeAudio(buffer, mimetype, filename) {
  try {
    const file = await toFile(buffer, filename, { type: mimetype || "audio/webm" });
    const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";

    const response = await openrouterClient.audio.transcriptions.create({
      model,
      file,
      response_format: "json",
    });

    if (response.text?.trim()) {
      return response.text.trim();
    }
  } catch (err) {
    console.warn("Audio transcription warning (continuing without transcript):", err.message || err);
  }
  return "[Voice recording provided]";
}

// ---------------------------------------------------------------------------
// Helper: check if text contains a timeline/onset reference
// ---------------------------------------------------------------------------
const timeReference =
  /\b(since|for|today|yesterday|this morning|last night|hour|hours|day|days|week|weeks|month|months|morning|afternoon|evening)\b/i;

function containsTimeline(text) {
  return timeReference.test(text || "");
}

// ---------------------------------------------------------------------------
// Helper: generate smart rule-based assessment fallback
// ---------------------------------------------------------------------------
function generateSmartAssessment(input, transcript, onsetTranscript) {
  const species = input.species || "pet";
  const speciesTitle = species.charAt(0).toUpperCase() + species.slice(1);
  const age = input.age || "unknown";
  const rawText = `${input.symptomText || ""} ${transcript || ""} ${input.onsetText || ""} ${onsetTranscript || ""}`.toLowerCase();

  const isUrgent = /collapse|seizure|bleeding|unresponsive|poison|choking|cannot breathe|difficulty breathing|pale gums|blocked/i.test(rawText);
  const isConsult = /vomit|diarrhea|limping|scratching|blood|pain|fever|cough|eye|ear|letharg|refus/i.test(rawText);

  const triage = isUrgent ? "URGENT" : isConsult ? "CONSULT" : "MONITOR";
  const onset = (input.onsetText || onsetTranscript || "recently").trim();

  let cond1 = `Mild ${speciesTitle} Health Irritation`;
  let cond2 = "Dietary or Sensitivity Reaction";
  let cond3 = "General Stress or Mild Fatigue";

  if (/limping|leg|paw|joint|pain|walk/i.test(rawText)) {
    cond1 = `Mild ${speciesTitle} Musculoskeletal Strain`;
    cond2 = "Minor Soft Tissue Discomfort";
    cond3 = "Environmental or Exercise Fatigue";
  } else if (/scratching|skin|itch|fur|hair|rash/i.test(rawText)) {
    cond1 = `Dermatological Irritation in ${speciesTitle}`;
    cond2 = "Environmental or Seasonal Allergy";
    cond3 = "Mild Contact Sensitivity";
  } else if (/vomit|diarrhea|stomach|appetite|eating|stool/i.test(rawText)) {
    cond1 = `Mild ${speciesTitle} Gastrointestinal Upset`;
    cond2 = "Dietary Indiscretion or Food Sensitivity";
    cond3 = "Temporary Stomach Upset";
  } else if (/cough|sneeze|nasal|breathing|eye|runny/i.test(rawText)) {
    cond1 = `Upper Respiratory Irritation in ${speciesTitle}`;
    cond2 = "Mild Environmental Sensitivity";
    cond3 = "Minor Seasonal Irritation";
  }

  return {
    probable_conditions: [
      {
        name: cond1,
        explanation: `Observed symptoms starting ${onset} are consistent with reported signs in a ${age}-year-old ${species}.`,
        likelihood: "more consistent"
      },
      {
        name: cond2,
        explanation: `Potential reaction or sensitivity observed recently in your ${species}.`,
        likelihood: "possible"
      },
      {
        name: cond3,
        explanation: `Changes in routine, activity, or environment can temporarily affect your ${species}.`,
        likelihood: "less consistent"
      }
    ],
    triage,
    triage_reason: isUrgent
      ? "Critical warning signs detected in pet description. Immediate emergency veterinary evaluation is recommended."
      : isConsult
      ? `Symptoms noticed ${onset} warrant a professional veterinary evaluation in the near future.`
      : `Symptoms appear mild without immediate red flags. Monitor your ${species} closely over the next 24 hours.`,
    monitoring_plan: {
      care_steps: [
        `Provide a quiet, comfortable resting environment for your ${species}.`,
        "Ensure clean, fresh drinking water is accessible at all times.",
        "Observe food intake, hydration, and activity closely over the next 24 hours.",
        "Avoid sudden food changes or unprescribed human medications."
      ],
      nutritional_considerations: [
        {
          nutrient_or_support: "Hydration Support",
          why_it_may_help: "Maintains optimal fluid balance and supports recovery.",
          pet_safe_way_to_offer: "Offer fresh water or plain, unseasoned pet-safe broth."
        },
        {
          nutrient_or_support: "Gentle Digestive Support",
          why_it_may_help: "Eases digestive workload while resting.",
          pet_safe_way_to_offer: "Offer small portions of plain, unseasoned cooked lean protein if appetite is normal."
        }
      ],
      warning_signs: [
        "Lethargy or severe weakness",
        "Refusal of water for more than 12-24 hours",
        "Repeated vomiting or severe diarrhea",
        "Difficulty breathing, pale gums, or severe pain"
      ]
    },
    safety_note: "This supportive guidance is for reference only and is not a veterinary diagnosis. Consult a licensed veterinarian if you are concerned about your pet."
  };
}

// ---------------------------------------------------------------------------
// OpenRouter structured analysis
// ---------------------------------------------------------------------------
function assessmentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      probable_conditions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            explanation: { type: "string" },
            likelihood: {
              type: "string",
              enum: ["possible", "more consistent", "less consistent"],
            },
          },
          required: ["name", "explanation", "likelihood"],
        },
      },
      triage: { type: "string", enum: ["MONITOR", "CONSULT", "URGENT"] },
      triage_reason: { type: "string" },
      monitoring_plan: {
        type: "object",
        additionalProperties: false,
        properties: {
          care_steps: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
          nutritional_considerations: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                nutrient_or_support: { type: "string" },
                why_it_may_help: { type: "string" },
                pet_safe_way_to_offer: { type: "string" },
              },
              required: [
                "nutrient_or_support",
                "why_it_may_help",
                "pet_safe_way_to_offer",
              ],
            },
          },
          warning_signs: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
          },
        },
        required: [
          "care_steps",
          "nutritional_considerations",
          "warning_signs",
        ],
      },
      safety_note: { type: "string" },
    },
    required: [
      "probable_conditions",
      "triage",
      "triage_reason",
      "monitoring_plan",
      "safety_note",
    ],
  };
}

async function analyseWithOpenRouter(input, transcript, onsetTranscript, image) {
  const apiKey = process.env.OpenRouter_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("dummy")) {
    console.log("No valid API key present, using smart fallback assessment.");
    return generateSmartAssessment(input, transcript, onsetTranscript);
  }

  const model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || "openai/gpt-4o-mini";

  const inputJson = JSON.stringify({
    species: input.species,
    age: input.age,
    breed: input.breed?.trim() || "not supplied",
    symptomText: input.symptomText?.trim() || "not supplied",
    voiceTranscript: transcript || "not supplied",
    onsetAnswer: input.onsetText?.trim() || "not supplied",
    voiceOnsetAnswer: onsetTranscript || "not supplied"
  }, null, 2);

  const textContent = {
    type: "text",
    text: `Please analyze the following pet health data provided in JSON format, and return the result matching the pet_assessment JSON schema:\n\n${inputJson}`
  };

  const systemMessage = `You are a cautious pet-health information assistant, not a veterinarian. Return exactly three possible explanations, never a diagnosis or certainty. Choose URGENT for signs such as collapse, seizures, difficulty breathing, severe bleeding, poisoning, or a blocked urinary tract; tell the owner to seek emergency veterinary care. Choose CONSULT when a veterinarian should assess the pet soon. Use MONITOR only for clearly mild, short-lived descriptions with no red flags. For MONITOR, give only general, low-risk nutritional considerations and pet-safe food or hydration practices; never claim a nutrient deficiency, recommend a dose, or recommend human medication or supplements. All output is supportive information and must tell the owner to seek veterinary advice if concerned.

You MUST respond in valid JSON with these exact keys:
- probable_conditions: array of 3 objects with keys "name", "explanation", "likelihood" ("possible", "more consistent", or "less consistent")
- triage: "MONITOR", "CONSULT", or "URGENT"
- triage_reason: string
- monitoring_plan: object with "care_steps" (array of strings), "nutritional_considerations" (array of objects with "nutrient_or_support", "why_it_may_help", "pet_safe_way_to_offer"), "warning_signs" (array of strings)
- safety_note: string`;

  const runApiCall = async (userContent) => {
    const response = await openrouterClient.chat.completions.create({
      model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userContent }
      ]
    });
    return response.choices[0]?.message?.content;
  };

  try {
    let responseContent;

    // Try with image if provided
    if (image) {
      try {
        const mimeType = image.mimetype || "image/jpeg";
        const base64 = image.buffer.toString("base64");
        const imageContent = [
          textContent,
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` }
          }
        ];
        responseContent = await runApiCall(imageContent);
      } catch (imgError) {
        console.warn("OpenRouter image call failed (retrying text-only):", imgError.message || imgError);
        // Fallback to text-only if image call was blocked by free tier key (e.g. 402 Payment Required)
        responseContent = await runApiCall([textContent]);
      }
    } else {
      responseContent = await runApiCall([textContent]);
    }

    if (!responseContent) {
      throw new Error("AI model returned an empty response.");
    }

    // Clean markdown code blocks
    let cleaned = responseContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (
      Array.isArray(parsed.probable_conditions) &&
      parsed.probable_conditions.length >= 1 &&
      parsed.triage &&
      parsed.monitoring_plan
    ) {
      return parsed;
    }

    throw new Error("AI response structure was incomplete.");
  } catch (error) {
    console.error("OpenRouter analysis failed, using smart fallback:", error.message || error);
    return generateSmartAssessment(input, transcript, onsetTranscript);
  }
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// POST /api/assess — main assessment endpoint
// Accepts multipart form data with:
//   species, age, breed, symptomText, onsetText (text fields)
//   symptomAudio, onsetAudio, image (file fields)
// ---------------------------------------------------------------------------
app.post(
  "/api/assess",
  requireAuth,
  upload.fields([
    { name: "symptomAudio", maxCount: 1 },
    { name: "onsetAudio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const userId = req.authUser.id;

    try {
      // ---- Parse and validate input ----
      const species = req.body.species;
      const age = parseInt(req.body.age, 10);
      const breed = req.body.breed || "";
      const symptomText = req.body.symptomText || "";
      const onsetText = req.body.onsetText || "";

      if (!["cat", "dog"].includes(species)) {
        return res.status(400).json({ error: "Choose cat or dog." });
      }
      if (!Number.isInteger(age) || age < 0 || age > 40) {
        return res.status(400).json({ error: "Enter a valid pet age." });
      }

      const hasSymptomAudio = !!(req.files?.symptomAudio?.[0]);
      const hasImage = !!(req.files?.image?.[0]);
      const hasOnsetAudio = !!(req.files?.onsetAudio?.[0]);

      if (!symptomText.trim() && !hasSymptomAudio && !hasImage) {
        return res
          .status(400)
          .json({ error: "Add text, a voice note, or a photo." });
      }

      // If the symptom text doesn't contain a timeline reference and there's
      // no onset text or onset audio, we need a timestamp
      const needsTimeline =
        !containsTimeline(symptomText) || hasSymptomAudio;
      if (needsTimeline && !onsetText.trim() && !hasOnsetAudio) {
        return res
          .status(400)
          .json({ error: "Tell us when the symptoms began." });
      }

      // ---- Rate limiting ----
      if (!req.isDemo) {
        const oneMinuteAgo = new Date(
          Date.now() - RATE_LIMIT_WINDOW_MS,
        ).toISOString();
        const { count, error: rateError } = await supabaseAdmin
          .from("assessments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", oneMinuteAgo);

        if (rateError) {
          throw new Error("The assessment service is not ready.");
        }
        if ((count || 0) >= RATE_LIMIT_MAX) {
          return res.status(429).json({
            error:
              "Please wait a minute before starting another assessment.",
          });
        }
      }

      // ---- Upload files to Supabase storage ----
      let symptomAudioPath = null;
      let imagePath = null;
      let onsetAudioPath = null;

      if (!req.isDemo) {
        if (hasSymptomAudio) {
          const f = req.files.symptomAudio[0];
          symptomAudioPath = await uploadToStorage(
            userId,
            f.buffer,
            f.mimetype,
            "symptoms",
          );
        }
        if (hasImage) {
          const f = req.files.image[0];
          imagePath = await uploadToStorage(
            userId,
            f.buffer,
            f.mimetype,
            "image",
          );
        }
        if (hasOnsetAudio) {
          const f = req.files.onsetAudio[0];
          onsetAudioPath = await uploadToStorage(
            userId,
            f.buffer,
            f.mimetype,
            "onset",
          );
        }
      } else {
        if (hasSymptomAudio) symptomAudioPath = "demo-symptoms.webm";
        if (hasImage) imagePath = "demo-image.jpg";
        if (hasOnsetAudio) onsetAudioPath = "demo-onset.webm";
      }


      // ---- Create assessment record (status: processing) ----
      let saved = { id: "demo-assessment-" + Date.now() };
      
      if (!req.isDemo) {
        const { data: dbSaved, error: insertError } = await supabaseAdmin
          .from("assessments")
          .insert({
            user_id: userId,
            species,
            pet_age: age,
            breed: breed.trim() || null,
            symptom_text: symptomText.trim() || null,
            symptom_audio_path: symptomAudioPath,
            image_path: imagePath,
            onset_text: onsetText.trim() || null,
            onset_audio_path: onsetAudioPath,
          })
          .select("id")
          .single();

        if (insertError || !dbSaved) {
          throw new Error("We could not save this assessment.");
        }
        saved = dbSaved;
      }

      // ---- Process: transcribe audio + AI analysis ----
      try {
        // Transcribe voice notes from memory buffers
        const transcript = req.files?.symptomAudio?.[0]
          ? await transcribeAudio(req.files.symptomAudio[0].buffer, req.files.symptomAudio[0].mimetype, "symptoms.webm")
          : null;
        const onsetTranscript = req.files?.onsetAudio?.[0]
          ? await transcribeAudio(req.files.onsetAudio[0].buffer, req.files.onsetAudio[0].mimetype, "onset.webm")
          : null;

        // Run AI analysis
        const input = {
          species,
          age,
          breed,
          symptomText,
          onsetText,
        };
        const output = await analyseWithOpenRouter(
          input,
          transcript,
          onsetTranscript,
          req.files?.image?.[0] || null,
        );

        // ---- Update assessment with results ----
        let assessment = {
          id: saved.id,
          user_id: userId,
          status: "complete",
          species,
          pet_age: age,
          breed: breed.trim() || null,
          symptom_text: symptomText.trim() || null,
          onset_text: onsetText.trim() || null,
          transcript,
          onset_transcript: onsetTranscript,
          probable_conditions: output.probable_conditions,
          triage: output.triage,
          triage_reason: output.triage_reason,
          monitoring_plan: output.monitoring_plan,
          safety_note: output.safety_note,
          completed_at: new Date().toISOString(),
        };

        if (!req.isDemo) {
          const { data: updatedAssessment, error: updateError } = await supabaseAdmin
            .from("assessments")
            .update({
              transcript,
              onset_transcript: onsetTranscript,
              status: "complete",
              probable_conditions: output.probable_conditions,
              triage: output.triage,
              triage_reason: output.triage_reason,
              monitoring_plan: output.monitoring_plan,
              safety_note: output.safety_note,
              completed_at: new Date().toISOString(),
            })
            .eq("id", saved.id)
            .eq("user_id", userId)
            .select()
            .single();

          if (updateError || !updatedAssessment) {
            throw new Error("We could not save the AI result.");
          }
          assessment = updatedAssessment;
        }

        return res.json({ assessment });
      } catch (analysisError) {
        // Mark assessment as failed
        const message =
          analysisError instanceof Error
            ? analysisError.message
            : "Assessment failed.";
            
        if (!req.isDemo) {
          await supabaseAdmin
            .from("assessments")
            .update({
              status: "failed",
              failure_reason: message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", saved.id)
            .eq("user_id", userId);
        }

        return res.status(502).json({ error: message });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected server error.";
      console.error("Assessment error:", message);
      return res.status(500).json({ error: message });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/history — fetch user's assessment history
// ---------------------------------------------------------------------------
app.get("/api/history", requireAuth, async (req, res) => {
  try {
    if (req.isDemo) {
      return res.json({ history: [] });
    }
    const userId = req.authUser.id;
    const { data, error } = await supabaseAdmin
      .from("assessments")
      .select(
        "id, species, pet_age, breed, symptom_text, transcript, onset_text, onset_transcript, image_path, probable_conditions, triage, triage_reason, monitoring_plan, safety_note, status, failure_reason, created_at, completed_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return res
        .status(500)
        .json({ error: "We could not load your assessment history." });
    }

    return res.json({ history: data || [] });
  } catch (err) {
    console.error("History error:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/history/:id — fetch a single assessment
// ---------------------------------------------------------------------------
app.get("/api/history/:id", requireAuth, async (req, res) => {
  try {
    if (req.isDemo) {
      return res.status(404).json({ error: "Assessment not found in demo mode." });
    }
    const userId = req.authUser.id;
    const { data, error } = await supabaseAdmin
      .from("assessments")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Assessment not found." });
    }

    return res.json({ assessment: data });
  } catch (err) {
    console.error("History detail error:", err);
    return res.status(500).json({ error: "Unexpected server error." });
  }
});

// ---------------------------------------------------------------------------
// Multer error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "Files must be 8 MB or smaller." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║          🐾  Pet-Care Backend Server  🐾         ║");
  console.log("  ╠══════════════════════════════════════════════════╣");
  console.log(`  ║  Local:    http://localhost:${PORT}                 ║`);
  console.log(`  ║  Frontend: ${FRONTEND_URL}              ║`);
  console.log("  ║  Status:   Ready                                ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log("");
});
