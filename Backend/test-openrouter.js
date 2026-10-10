import "dotenv/config";
import OpenAI from "openai";

const openrouterClient = new OpenAI({
  apiKey: process.env.OpenRouter_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

async function run() {
  const modelsToTest = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "dots-studio/dots-3-note-preview:free",
    "nvidia/nemotron-3.5-lightning:free",
    "liquid/lfm-2.5-2.6b:free",
    "apodex/apodex-1.1-mini:free"
  ];
  for (const m of modelsToTest) {
    try {
      console.log("Testing model:", m);
      const response = await openrouterClient.chat.completions.create({
        model: m,
        max_tokens: 100,
        messages: [
          { role: "user", content: "Hello, return JSON: {\"status\": \"ok\"}" }
        ]
      });
      console.log("Success with " + m + ":", JSON.stringify(response, null, 2));
      break;
    } catch (error) {
      console.error("Error with " + m + ":", error.message);
    }
  }
}
run();
