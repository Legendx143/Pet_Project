import { createClient } from "npm:@supabase/supabase-js@2";

type AssessmentRequest = {
  species: "cat" | "dog";
  age: number;
  breed?: string;
  symptomText?: string;
  symptomAudioPath?: string;
  imagePath?: string;
  onsetText?: string;
  onsetAudioPath?: string;
};

type Condition = {
  name: string;
  explanation: string;
  likelihood: "possible" | "more consistent" | "less consistent";
};

type AssessmentOutput = {
  probable_conditions: Condition[];
  triage: "MONITOR" | "CONSULT" | "URGENT";
  triage_reason: string;
  monitoring_plan: {
    care_steps: string[];
    nutritional_considerations: Array<{
      nutrient_or_support: string;
      why_it_may_help: string;
      pet_safe_way_to_offer: string;
    }>;
    warning_signs: string[];
  };
  safety_note: string;
};

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function badRequest(message: string) {
  return reply({ error: message }, 400);
}

function mustGetSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getSecretKey() {
  const namedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (namedKeys) {
    const parsed = JSON.parse(namedKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  return mustGetSecret("SUPABASE_SERVICE_ROLE_KEY");
}

function getPublishableKey() {
  const namedKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (namedKeys) {
    const parsed = JSON.parse(namedKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  return mustGetSecret("SUPABASE_PUBLISHABLE_KEY");
}

function assertOwnPath(path: string | undefined, userId: string) {
  if (!path) return;
  if (!path.startsWith(`${userId}/`) || path.includes("..")) {
    throw new Error("An uploaded media path is invalid.");
  }
}

function asBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hasUsableInput(input: AssessmentRequest) {
  return Boolean(input.symptomText?.trim() || input.symptomAudioPath || input.imagePath);
}

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
          care_steps: { type: "array", items: { type: "string" }, maxItems: 4 },
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
              required: ["nutrient_or_support", "why_it_may_help", "pet_safe_way_to_offer"],
            },
          },
          warning_signs: { type: "array", items: { type: "string" }, maxItems: 5 },
        },
        required: ["care_steps", "nutritional_considerations", "warning_signs"],
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

async function downloadOwnedMedia(
  admin: ReturnType<typeof createClient>,
  path: string | undefined,
) {
  if (!path) return null;
  const { data, error } = await admin.storage.from("assessment-media").download(path);
  if (error || !data) throw new Error("We could not read an uploaded file.");
  if (data.size > MAX_MEDIA_BYTES) throw new Error("Uploaded files must be 8 MB or smaller.");
  return data;
}

async function transcribe(blob: Blob, filename: string, apiKey: string) {
  const form = new FormData();
  form.append("model", Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  form.append("file", new File([blob], filename, { type: blob.type || "audio/webm" }));

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error("Voice transcription was unavailable.");

  const data = await response.json();
  if (typeof data.text !== "string" || !data.text.trim()) {
    throw new Error("We could not understand the voice recording.");
  }
  return data.text.trim();
}

async function analyseWithOpenAI(
  input: AssessmentRequest,
  transcript: string | null,
  onsetTranscript: string | null,
  image: Blob | null,
  apiKey: string,
) {
  const userText = [
    `Pet species: ${input.species}.`,
    `Pet age: ${input.age}.`,
    input.breed?.trim() ? `Breed: ${input.breed.trim()}.` : "Breed: not supplied.",
    input.symptomText?.trim() ? `Owner text: ${input.symptomText.trim()}` : "Owner text: not supplied.",
    transcript ? `Voice transcript: ${transcript}` : "Voice transcript: not supplied.",
    input.onsetText?.trim() ? `Owner onset answer: ${input.onsetText.trim()}` : "Owner onset answer: not supplied.",
    onsetTranscript ? `Voice onset answer: ${onsetTranscript}` : "Voice onset answer: not supplied.",
  ].join("\n");

  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: userText }];
  if (image) {
    const mimeType = image.type || "image/jpeg";
    content.push({
      type: "input_image",
      detail: "low",
      image_url: `data:${mimeType};base64,${asBase64(new Uint8Array(await image.arrayBuffer()))}`,
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      store: false,
      input: [
        {
          role: "developer",
          content: `You are a cautious pet-health information assistant, not a veterinarian. Return exactly three possible explanations, never a diagnosis or certainty. Choose URGENT for signs such as collapse, seizures, difficulty breathing, severe bleeding, poisoning, or a blocked urinary tract; tell the owner to seek emergency veterinary care. Choose CONSULT when a veterinarian should assess the pet soon. Use MONITOR only for clearly mild, short-lived descriptions with no red flags. For MONITOR, give only general, low-risk nutritional considerations and pet-safe food or hydration practices; never claim a nutrient deficiency, recommend a dose, or recommend human medication or supplements. All output is supportive information and must tell the owner to seek veterinary advice if concerned.`,
        },
        { role: "user", content },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "pet_assessment",
          strict: true,
          schema: assessmentSchema(),
        },
      },
    }),
  });

  if (!response.ok) throw new Error("AI analysis was unavailable. Please try again shortly.");
  const payload = await response.json();
  if (typeof payload.output_text !== "string") throw new Error("AI analysis returned an invalid response.");
  return JSON.parse(payload.output_text) as AssessmentOutput;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return reply({ error: "Authentication is required." }, 401);

    const projectUrl = mustGetSecret("SUPABASE_URL");
    const userClient = createClient(projectUrl, getPublishableKey(), {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Authentication is required." }, 401);

    const input = await req.json() as AssessmentRequest;
    if (!input || !["cat", "dog"].includes(input.species)) return badRequest("Choose cat or dog.");
    if (!Number.isInteger(input.age) || input.age < 0 || input.age > 40) return badRequest("Enter a valid pet age.");
    if (!hasUsableInput(input)) return badRequest("Add text, a voice note, or a photo.");
    if (!input.onsetText?.trim() && !input.onsetAudioPath) {
      return badRequest("Tell us when the symptoms began.");
    }

    const userId = authData.user.id;
    assertOwnPath(input.symptomAudioPath, userId);
    assertOwnPath(input.imagePath, userId);
    assertOwnPath(input.onsetAudioPath, userId);

    const admin = createClient(projectUrl, getSecretKey());
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateError } = await admin
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);
    if (rateError) throw new Error("The assessment service is not ready.");
    if ((count || 0) >= 3) return reply({ error: "Please wait a minute before starting another assessment." }, 429);

    const { data: saved, error: insertError } = await admin
      .from("assessments")
      .insert({
        user_id: userId,
        species: input.species,
        pet_age: input.age,
        breed: input.breed?.trim() || null,
        symptom_text: input.symptomText?.trim() || null,
        symptom_audio_path: input.symptomAudioPath || null,
        image_path: input.imagePath || null,
        onset_text: input.onsetText?.trim() || null,
        onset_audio_path: input.onsetAudioPath || null,
      })
      .select("id")
      .single();
    if (insertError || !saved) throw new Error("We could not save this assessment.");

    try {
      const apiKey = mustGetSecret("OPENAI_API_KEY");
      const symptomAudio = await downloadOwnedMedia(admin, input.symptomAudioPath);
      const onsetAudio = await downloadOwnedMedia(admin, input.onsetAudioPath);
      const image = await downloadOwnedMedia(admin, input.imagePath);
      const transcript = symptomAudio ? await transcribe(symptomAudio, "symptoms.webm", apiKey) : null;
      const onsetTranscript = onsetAudio ? await transcribe(onsetAudio, "onset.webm", apiKey) : null;
      const output = await analyseWithOpenAI(input, transcript, onsetTranscript, image, apiKey);

      const { data: assessment, error: updateError } = await admin
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
      if (updateError || !assessment) throw new Error("We could not save the AI result.");
      return reply({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assessment failed.";
      await admin
        .from("assessments")
        .update({ status: "failed", failure_reason: message, completed_at: new Date().toISOString() })
        .eq("id", saved.id)
        .eq("user_id", userId);
      return reply({ error: message }, 502);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return reply({ error: message }, 500);
  }
});
