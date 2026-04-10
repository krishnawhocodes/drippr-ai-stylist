import { z } from "zod";
import {
  imageSignalsSchema,
  occasionContextSchema,
  type Gender,
  type ImageSignals,
  type OccasionContext,
} from "./schemas.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const TEXT_MODEL = "openai/gpt-oss-20b";

function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;

  if (!key || !key.trim()) {
    throw new Error("Missing GROQ_API_KEY");
  }

  return key;
}

async function groqRequest(payload: Record<string, unknown>) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireGroqKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Groq request failed (${response.status}): ${text}`);
  }

  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Groq returned an empty response");
  }

  return content;
}

function safeJsonParse<T>(raw: string, schema: z.ZodSchema<T>): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model response was not valid JSON");
    }
    parsed = JSON.parse(match[0]);
  }

  return schema.parse(parsed);
}

export async function analyzeStylePhoto(input: {
  imageDataUrl: string;
  gender?: Gender;
  vibe?: string;
  category?: string;
}): Promise<ImageSignals> {
  const prompt = [
    "You are analyzing a fashion photo for an AI stylist recommendation engine.",
    "The uploaded image has already passed a full-body validation gate.",
    "Return ONLY strict JSON.",
    "Do not give medical opinions.",
    "Focus only on visible style cues.",
    "Infer cautiously.",
    "If any field is unclear, return 'unknown'.",
    "Fields needed:",
    "- dominantColors: visible clothing colors only",
    "- paletteTemperature: warm | cool | neutral | unknown",
    "- skinToneBand: light | medium | deep | unknown",
    "- undertone: warm | cool | neutral | unknown",
    "- fitCues: broad cues like slim, straight, relaxed, oversized, tailored",
    "- vibeTags: style tags like minimal, streetwear, elegant, festive, casual, sporty",
    "- visibleGarments: broad garment labels like tee, dress, kurta, jacket, trousers",
    "- confidence: 0 to 1",
    `User context gender: ${input.gender ?? "unknown"}`,
    `User-selected vibe: ${input.vibe ?? "unknown"}`,
    `User-selected category: ${input.category ?? "unknown"}`,
  ].join("\n");

  const raw = await groqRequest({
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 350,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise fashion-analysis engine that returns only JSON.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: input.imageDataUrl,
            },
          },
        ],
      },
    ],
  });

  return safeJsonParse(raw, imageSignalsSchema);
}

export async function parseOccasionContext(input: {
  occasion: string;
  gender?: Gender;
  vibe?: string;
  category?: string;
}): Promise<OccasionContext> {
  const jsonSchema = {
    name: "occasion_context",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        eventType: { type: "string" },
        timeOfDay: {
          type: "string",
          enum: ["day", "night", "evening", "unknown"],
        },
        season: {
          type: "string",
          enum: [
            "summer",
            "winter",
            "monsoon",
            "spring",
            "autumn",
            "all_season",
            "unknown",
          ],
        },
        formality: {
          type: "string",
          enum: [
            "casual",
            "smart_casual",
            "semi_formal",
            "formal",
            "festive",
            "unknown",
          ],
        },
        comfortPriority: { type: "string", enum: ["low", "medium", "high"] },
        styleDirection: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
        avoidKeywords: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
        },
        confidence: { type: "number" },
      },
      required: [
        "eventType",
        "timeOfDay",
        "season",
        "formality",
        "comfortPriority",
        "styleDirection",
        "avoidKeywords",
        "confidence",
      ],
    },
    strict: true,
  };

  const prompt = [
    "Convert the user's occasion description into recommendation-ready structured fashion context.",
    "Return no prose.",
    "Use conservative inference.",
    "If the user does not mention a value clearly, use 'unknown'.",
    "eventType should be a short snake_case label such as college_fest, wedding_guest, office_presentation, date_night.",
    "styleDirection should contain concise style goals.",
    "avoidKeywords should contain things that should be avoided if clearly implied by the user.",
    `User gender context: ${input.gender ?? "unknown"}`,
    `User-selected vibe: ${input.vibe ?? "unknown"}`,
    `User-selected category: ${input.category ?? "unknown"}`,
    `Occasion text: ${input.occasion}`,
  ].join("\n");

  const raw = await groqRequest({
    model: TEXT_MODEL,
    temperature: 0.1,
    max_tokens: 300,
    response_format: {
      type: "json_schema",
      json_schema: jsonSchema,
    },
    messages: [
      {
        role: "system",
        content:
          "You are a precise occasion parser for a fashion recommendation engine.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return safeJsonParse(raw, occasionContextSchema);
}
