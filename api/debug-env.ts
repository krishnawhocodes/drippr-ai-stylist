import { getAdminDb } from "./_lib/firebaseAdmin.js";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
    const hasProjectId = Boolean(process.env.FIREBASE_PROJECT_ID?.trim());
    const hasClientEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim());
    const hasPrivateKey = Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim());

    const db = getAdminDb();
    const snap = await db.collection("merchantProducts").limit(1).get();

    return res.status(200).json({
      ok: true,
      env: {
        hasGroq,
        hasProjectId,
        hasClientEmail,
        hasPrivateKey,
      },
      firestore: {
        reachable: true,
        sampleCount: snap.size,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}