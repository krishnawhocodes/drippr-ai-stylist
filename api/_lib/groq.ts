import type { OccasionContext } from "./schemas.js";
import { occasionContextSchema } from "./schemas.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[], max = 20) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(
    0,
    max,
  );
}

function normalizeStringArray(value: unknown, max = 20): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.filter((item): item is string => typeof item === "string"),
      max,
    );
  }

  if (typeof value === "string") {
    return uniqueStrings(
      value
        .split(/[,\n/|]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      max,
    );
  }

  return [];
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof value !== "string") return fallback;
  const normalized = normalizeText(value);
  const matched = allowed.find((item) => item === normalized);
  return (matched ?? fallback) as T[number];
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  return fallback;
}

function normalizeOccasionContext(raw: unknown): OccasionContext {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const normalized = {
    eventType:
      typeof obj.eventType === "string" && obj.eventType.trim()
        ? normalizeText(obj.eventType).replace(/\s+/g, "_")
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
    preferredKeywords: normalizeStringArray(obj.preferredKeywords, 20),
    avoidKeywords: normalizeStringArray(obj.avoidKeywords, 20),
    preferredProductTypes: normalizeStringArray(obj.preferredProductTypes, 10),
    confidence: normalizeNumber(obj.confidence, 0.65),
  };

  return occasionContextSchema.parse(normalized);
}

function safeResponseSnippet(text: string, max = 1200) {
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

function fallbackOccasionContext(occasion: string): OccasionContext {
  const text = normalizeText(occasion);

  let eventType = "general_event";
  if (text.includes("party")) eventType = "party";
  else if (text.includes("wedding")) eventType = "wedding_guest";
  else if (text.includes("office")) eventType = "office_event";
  else if (text.includes("fest")) eventType = "college_fest";

  const timeOfDay = text.includes("night")
    ? "night"
    : text.includes("evening")
      ? "evening"
      : text.includes("day") ||
          text.includes("morning") ||
          text.includes("afternoon")
        ? "day"
        : "unknown";

  const season = text.includes("summer")
    ? "summer"
    : text.includes("winter")
      ? "winter"
      : text.includes("monsoon") || text.includes("rain")
        ? "monsoon"
        : "unknown";

  const formality = text.includes("formal")
    ? "formal"
    : text.includes("party") || text.includes("date")
      ? "semi_formal"
      : "casual";

  return occasionContextSchema.parse({
    eventType,
    timeOfDay,
    season,
    formality,
    comfortPriority: season === "summer" ? "high" : "medium",
    styleDirection: [],
    preferredKeywords: [],
    avoidKeywords: [],
    preferredProductTypes: [],
    confidence: 0.5,
  });
}

export async function parseOccasionContext(input: {
  occasion: string;
  gender?: string;
  vibe?: string;
  category?: string;
  availableKeywords?: string[];
  availableProductTypes?: string[];
}): Promise<OccasionContext> {
  const prompt = [
    "You are helping an ecommerce AI stylist shortlist products.",
    "The main product pool has already been filtered by vibe, category, and budget.",
    "Your job is ONLY to convert the user's occasion into extra shortlist filters.",
    "Return ONLY valid JSON.",
    "Do not include markdown.",
    "Use these exact keys:",
    "eventType, timeOfDay, season, formality, comfortPriority, styleDirection, preferredKeywords, avoidKeywords, preferredProductTypes, confidence",
    "Allowed values:",
    "- timeOfDay: day | night | evening | unknown",
    "- season: summer | winter | monsoon | spring | autumn | all_season | unknown",
    "- formality: casual | smart_casual | semi_formal | formal | festive | unknown",
    "- comfortPriority: low | medium | high",
    "Use concise arrays.",
    `Selected vibe: ${input.vibe ?? "unknown"}`,
    `Selected category: ${input.category ?? "unknown"}`,
    `Available product keywords: ${(input.availableKeywords ?? []).slice(0, 40).join(", ")}`,
    `Available product types: ${(input.availableProductTypes ?? []).slice(0, 20).join(", ")}`,
    `Occasion: ${input.occasion}`,
    'Example JSON: {"eventType":"party","timeOfDay":"night","season":"summer","formality":"semi_formal","comfortPriority":"medium","styleDirection":["statement","night_ready"],"preferredKeywords":["black","graphic"],"avoidKeywords":["loungewear"],"preferredProductTypes":["sweatshirt"],"confidence":0.84}',
  ].join("\n");

  try {
    const raw = await groqRequest({
      model: TEXT_MODEL,
      temperature: 0,
      max_tokens: 280,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You return only JSON for occasion-based product shortlist filters.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const parsed = extractJsonObject(raw);
    return normalizeOccasionContext(parsed);
  } catch {
    return fallbackOccasionContext(input.occasion);
  }
}
