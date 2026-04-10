import { z } from "zod";
import {
  imageSignalsSchema,
  occasionContextSchema,
  type Gender,
  type ImageSignals,
  type OccasionContext,
} from "./schemas.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const TEXT_MODEL = "openai/gpt-oss-20b";

class GroqHttpError extends Error {
  status: number;
  responseBody: string;

  constructor(status: number, responseBody: string) {
    super(`Groq request failed (${status}): ${responseBody}`);
    this.name = "GroqHttpError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;

  if (!key || !key.trim()) {
    throw new Error("Missing GROQ_API_KEY");
  }

  return key;
}

function safeResponseSnippet(text: string, max = 1000) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
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
    throw new GroqHttpError(response.status, safeResponseSnippet(text));
  }

  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Groq returned an empty response");
  }

  return content;
}

function extractJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model response was not valid JSON");
    }
    return JSON.parse(match[0]);
  }
}

function safeJsonParse<T>(raw: string, schema: z.ZodSchema<T>): T {
  return schema.parse(extractJsonObject(raw));
}

function normalizeStringArray(value: unknown, max = 8): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, max);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, max);
  }

  return [];
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  const matched = allowed.find((item) => item === normalized);
  return (matched ?? fallback) as T[number];
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  return fallback;
}

function normalizeImageSignals(raw: unknown): ImageSignals {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const normalized = {
    dominantColors: normalizeStringArray(obj.dominantColors, 8),
    paletteTemperature: normalizeEnum(
      obj.paletteTemperature,
      ["warm", "cool", "neutral", "unknown"] as const,
      "unknown",
    ),
    skinToneBand: normalizeEnum(
      obj.skinToneBand,
      ["light", "medium", "deep", "unknown"] as const,
      "unknown",
    ),
    undertone: normalizeEnum(
      obj.undertone,
      ["warm", "cool", "neutral", "unknown"] as const,
      "unknown",
    ),
    fitCues: normalizeStringArray(obj.fitCues, 8),
    vibeTags: normalizeStringArray(obj.vibeTags, 8),
    visibleGarments: normalizeStringArray(obj.visibleGarments, 8),
    confidence: normalizeNumber(obj.confidence, 0.6),
  };

  return imageSignalsSchema.parse(normalized);
}

function normalizeOccasionContext(raw: unknown): OccasionContext {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const normalized = {
    eventType:
      typeof obj.eventType === "string" && obj.eventType.trim()
        ? obj.eventType.trim()
        : "general_event",
    timeOfDay: normalizeEnum(
      obj.timeOfDay,
      ["day", "night", "evening", "unknown"] as const,
      "unknown",
    ),
    season: normalizeEnum(
      obj.season,
      [
        "summer",
        "winter",
        "monsoon",
        "spring",
        "autumn",
        "all_season",
        "unknown",
      ] as const,
      "unknown",
    ),
    formality: normalizeEnum(
      obj.formality,
      [
        "casual",
        "smart_casual",
        "semi_formal",
        "formal",
        "festive",
        "unknown",
      ] as const,
      "unknown",
    ),
    comfortPriority: normalizeEnum(
      obj.comfortPriority,
      ["low", "medium", "high"] as const,
      "medium",
    ),
    styleDirection: normalizeStringArray(obj.styleDirection, 10),
    avoidKeywords: normalizeStringArray(obj.avoidKeywords, 10),
    confidence: normalizeNumber(obj.confidence, 0.6),
  };

  return occasionContextSchema.parse(normalized);
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
    "Return ONLY valid JSON.",
    "Do not give medical opinions.",
    "Focus only on visible style cues.",
    "Infer cautiously.",
    "If any field is unclear, return 'unknown'.",
    "If a field can contain multiple items, return an array.",
    "Use this exact JSON structure:",
    "{",
    '  "dominantColors": ["black", "white"],',
    '  "paletteTemperature": "warm",',
    '  "skinToneBand": "medium",',
    '  "undertone": "neutral",',
    '  "fitCues": ["relaxed", "straight"],',
    '  "vibeTags": ["minimal", "casual"],',
    '  "visibleGarments": ["tee", "trousers"],',
    '  "confidence": 0.8',
    "}",
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

  const parsed = extractJsonObject(raw);
  return normalizeImageSignals(parsed);
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

  const basePrompt = [
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

  try {
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
          content: basePrompt,
        },
      ],
    });

    return safeJsonParse(raw, occasionContextSchema);
  } catch (error) {
    const isSchemaFailure =
      error instanceof GroqHttpError &&
      error.status === 400 &&
      error.responseBody.includes("json_validate_failed");

    if (!isSchemaFailure) {
      throw error;
    }

    const fallbackPrompt = [
      "Return ONLY a valid JSON object.",
      "Do not include markdown.",
      "Do not include comments.",
      "Use these keys exactly:",
      "eventType, timeOfDay, season, formality, comfortPriority, styleDirection, avoidKeywords, confidence",
      "Allowed values:",
      "- timeOfDay: day | night | evening | unknown",
      "- season: summer | winter | monsoon | spring | autumn | all_season | unknown",
      "- formality: casual | smart_casual | semi_formal | formal | festive | unknown",
      "- comfortPriority: low | medium | high",
      "If unsure, choose unknown or medium.",
      basePrompt,
    ].join("\n");

    const rawFallback = await groqRequest({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You return only JSON objects for fashion occasion parsing.",
        },
        {
          role: "user",
          content: fallbackPrompt,
        },
      ],
    });

    const parsed = extractJsonObject(rawFallback);
    return normalizeOccasionContext(parsed);
  }
}
