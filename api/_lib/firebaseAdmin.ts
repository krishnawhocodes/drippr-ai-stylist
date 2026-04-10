import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(raw: string) {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, "\n");

  if (
    !value.includes("BEGIN PRIVATE KEY") ||
    !value.includes("END PRIVATE KEY")
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not a valid service account private key.",
    );
  }

  return value;
}

let cachedDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }

  if (getApps().length === 0) {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = normalizePrivateKey(requireEnv("FIREBASE_PRIVATE_KEY"));

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  cachedDb = getFirestore();
  return cachedDb;
}
