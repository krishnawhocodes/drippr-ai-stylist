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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function uniqueStrings(values: string[], max = 10) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(
    0,
    max,
  );
}

function detectEventType(text: string): string {
  if (
    includesAny(text, [
      "college fest",
      "college festival",
      "campus fest",
      "fest",
    ])
  )
    return "college_fest";
  if (includesAny(text, ["wedding", "shaadi", "marriage"]))
    return "wedding_guest";
  if (includesAny(text, ["engagement", "roka"])) return "engagement";
  if (
    includesAny(text, [
      "office",
      "client presentation",
      "presentation",
      "meeting",
      "work",
    ])
  )
    return "office_event";
  if (includesAny(text, ["date", "dinner date", "date night"]))
    return "date_night";
  if (includesAny(text, ["party", "club", "birthday"])) return "party";
  if (includesAny(text, ["brunch", "lunch"])) return "brunch";
  if (includesAny(text, ["travel", "trip", "vacation", "holiday"]))
    return "travel";
  if (includesAny(text, ["concert", "music event", "show"])) return "concert";
  if (includesAny(text, ["interview"])) return "interview";
  return "general_event";
}

function detectTimeOfDay(text: string): OccasionContext["timeOfDay"] {
  if (includesAny(text, ["night", "late night", "after dark"])) return "night";
  if (includesAny(text, ["evening", "sunset", "dinner"])) return "evening";
  if (includesAny(text, ["day", "daytime", "morning", "afternoon"]))
    return "day";
  return "unknown";
}

function detectSeason(text: string): OccasionContext["season"] {
  if (includesAny(text, ["summer", "hot weather", "heat", "humid"]))
    return "summer";
  if (includesAny(text, ["winter", "cold", "chilly"])) return "winter";
  if (includesAny(text, ["monsoon", "rain", "rainy"])) return "monsoon";
  if (includesAny(text, ["spring"])) return "spring";
  if (includesAny(text, ["autumn", "fall"])) return "autumn";
  return "unknown";
}

function detectFormality(
  text: string,
  eventType: string,
): OccasionContext["formality"] {
  if (includesAny(text, ["formal", "black tie", "very formal"]))
    return "formal";
  if (includesAny(text, ["semi formal", "semi-formal"])) return "semi_formal";
  if (includesAny(text, ["smart casual", "smart-casual"]))
    return "smart_casual";
  if (includesAny(text, ["festive", "traditional", "ethnic"])) return "festive";
  if (includesAny(text, ["casual", "comfortable", "easygoing"]))
    return "casual";

  if (eventType === "wedding_guest" || eventType === "engagement")
    return "festive";
  if (eventType === "office_event" || eventType === "interview")
    return "smart_casual";
  if (eventType === "date_night" || eventType === "party") return "semi_formal";
  if (eventType === "college_fest" || eventType === "travel") return "casual";

  return "unknown";
}

function detectComfortPriority(
  text: string,
  season: OccasionContext["season"],
): OccasionContext["comfortPriority"] {
  if (
    includesAny(text, [
      "comfortable",
      "comfort",
      "breathable",
      "all day",
      "long hours",
      "walking",
      "heat",
      "humid",
      "summer",
      "lightweight",
    ])
  ) {
    return "high";
  }

  if (season === "summer" || season === "monsoon") return "high";
  return "medium";
}

function detectStyleDirection(
  text: string,
  eventType: string,
  formality: OccasionContext["formality"],
  season: OccasionContext["season"],
  timeOfDay: OccasionContext["timeOfDay"],
): string[] {
  const directions: string[] = [];

  if (includesAny(text, ["trendy", "stylish", "fashionable"]))
    directions.push("trendy");
  if (includesAny(text, ["youthful", "young", "college"]))
    directions.push("youthful");
  if (includesAny(text, ["breathable", "lightweight", "airy"]))
    directions.push("breathable");
  if (includesAny(text, ["elegant", "graceful"])) directions.push("elegant");
  if (includesAny(text, ["polished", "sharp"])) directions.push("polished");
  if (includesAny(text, ["minimal", "clean"])) directions.push("minimal");
  if (includesAny(text, ["street", "streetwear"]))
    directions.push("streetwear");
  if (includesAny(text, ["traditional", "ethnic"]))
    directions.push("traditional");
  if (includesAny(text, ["bold", "statement"])) directions.push("statement");
  if (includesAny(text, ["comfortable", "easy"]))
    directions.push("comfortable");

  if (eventType === "college_fest") directions.push("youthful", "trendy");
  if (eventType === "office_event") directions.push("polished");
  if (eventType === "date_night") directions.push("elegant");
  if (eventType === "party") directions.push("statement");
  if (eventType === "travel") directions.push("comfortable");

  if (formality === "festive") directions.push("festive");
  if (formality === "smart_casual") directions.push("smart");
  if (formality === "semi_formal") directions.push("refined");
  if (formality === "casual") directions.push("easygoing");

  if (season === "summer") directions.push("breathable");
  if (season === "winter") directions.push("layered");
  if (timeOfDay === "night") directions.push("evening_ready");

  return uniqueStrings(directions, 10);
}

function detectAvoidKeywords(text: string): string[] {
  const avoids: string[] = [];

  if (includesAny(text, ["not overdressed", "don't want to look overdressed"]))
    avoids.push("overdressed");
  if (includesAny(text, ["not too flashy", "avoid flashy"]))
    avoids.push("flashy");
  if (includesAny(text, ["avoid black", "no black"])) avoids.push("black");
  if (includesAny(text, ["avoid heels", "no heels"])) avoids.push("heels");
  if (includesAny(text, ["not too formal"])) avoids.push("too_formal");
  if (includesAny(text, ["not too casual"])) avoids.push("too_casual");

  return uniqueStrings(avoids, 10);
}

export async function parseOccasionContext(input: {
  occasion: string;
  gender?: Gender;
  vibe?: string;
  category?: string;
}): Promise<OccasionContext> {
  const text = normalizeText(input.occasion);

  const eventType = detectEventType(text);
  const timeOfDay = detectTimeOfDay(text);
  const season = detectSeason(text);
  const formality = detectFormality(text, eventType);
  const comfortPriority = detectComfortPriority(text, season);
  const styleDirection = detectStyleDirection(
    text,
    eventType,
    formality,
    season,
    timeOfDay,
  );
  const avoidKeywords = detectAvoidKeywords(text);

  const signalCount = [
    eventType !== "general_event",
    timeOfDay !== "unknown",
    season !== "unknown",
    formality !== "unknown",
    styleDirection.length > 0,
    avoidKeywords.length > 0,
  ].filter(Boolean).length;

  const confidence = Math.max(0.45, Math.min(0.9, 0.45 + signalCount * 0.08));

  return occasionContextSchema.parse({
    eventType,
    timeOfDay,
    season,
    formality,
    comfortPriority,
    styleDirection,
    avoidKeywords,
    confidence,
  });
}
