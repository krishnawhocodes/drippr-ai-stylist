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
  const prompt = [
    "Convert the user's occasion description into recommendation-ready structured fashion context.",
    "Return ONLY valid JSON.",
    "Do not include markdown.",
    "Do not include comments.",
    "Use conservative inference.",
    "If the user does not mention a value clearly, use 'unknown'.",
    "If the user gives a short occasion like wedding, party, office, college fest, still return the full JSON object.",
    "Use this exact JSON structure:",
    "{",
    '  "eventType": "college_fest",',
    '  "timeOfDay": "night",',
    '  "season": "summer",',
    '  "formality": "smart_casual",',
    '  "comfortPriority": "high",',
    '  "styleDirection": ["trendy", "breathable", "youthful"],',
    '  "avoidKeywords": [],',
    '  "confidence": 0.8',
    "}",
    "Allowed values:",
    "- timeOfDay: day | night | evening | unknown",
    "- season: summer | winter | monsoon | spring | autumn | all_season | unknown",
    "- formality: casual | smart_casual | semi_formal | formal | festive | unknown",
    "- comfortPriority: low | medium | high",
    `User gender context: ${input.gender ?? "unknown"}`,
    `User-selected vibe: ${input.vibe ?? "unknown"}`,
    `User-selected category: ${input.category ?? "unknown"}`,
    `Occasion text: ${input.occasion}`,
  ].join("\n");

  const raw = await groqRequest({
    model: TEXT_MODEL,
    temperature: 0,
    max_tokens: 250,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise fashion occasion parser that returns only JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const parsed = extractJsonObject(raw);
  return normalizeOccasionContext(parsed);
}
