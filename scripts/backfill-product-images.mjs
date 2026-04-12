import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API = process.env.SHOPIFY_API_VERSION || "2025-01";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n",
);

if (!SHOP || !TOKEN) {
  throw new Error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN");
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error("Missing Firebase admin env vars");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
}

const db = getFirestore();
const ENDPOINT = `https://${SHOP}/admin/api/${API}/graphql.json`;

async function shopifyGraphQL(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

const PRODUCT_IMAGES_QUERY = `
  query ProductImages($id: ID!) {
    product(id: $id) {
      id
      title
      images(first: 50) {
        nodes {
          id
          url
        }
      }
    }
  }
`;

function extractUrlsFromDoc(doc) {
  const urls = [];

  const pushIfString = (value) => {
    if (typeof value === "string" && value.trim()) {
      urls.push(value.trim());
    }
  };

  pushIfString(doc.image);

  if (Array.isArray(doc.images)) {
    for (const item of doc.images) {
      if (typeof item === "string") pushIfString(item);
      else if (item && typeof item === "object") {
        pushIfString(item.url);
        pushIfString(item.src);
        pushIfString(item.image);
        pushIfString(item.imageUrl);
        pushIfString(item.originalSrc);
      }
    }
  }

  if (Array.isArray(doc.imageUrls)) {
    for (const item of doc.imageUrls) {
      if (typeof item === "string") pushIfString(item);
      else if (item && typeof item === "object") {
        pushIfString(item.url);
        pushIfString(item.src);
        pushIfString(item.image);
        pushIfString(item.imageUrl);
        pushIfString(item.originalSrc);
      }
    }
  }

  return [...new Set(urls)];
}

function hasUsableImages(doc) {
  return extractUrlsFromDoc(doc).length > 0;
}

async function fetchShopifyImages(shopifyProductId) {
  const r = await shopifyGraphQL(PRODUCT_IMAGES_QUERY, {
    id: shopifyProductId,
  });
  const nodes = r?.data?.product?.images?.nodes || [];
  const urls = nodes
    .map((n) => (typeof n?.url === "string" ? n.url.trim() : ""))
    .filter(Boolean);

  return [...new Set(urls)];
}

async function run() {
  const snap = await db.collection("merchantProducts").get();

  let checked = 0;
  let missing = 0;
  let updated = 0;
  let alreadyHadImages = 0;
  let skippedNoShopifyId = 0;
  let noShopifyImages = 0;
  let failed = 0;

  for (const docSnap of snap.docs) {
    checked += 1;
    const data = docSnap.data();

    if (hasUsableImages(data)) {
      alreadyHadImages += 1;
      continue;
    }

    missing += 1;

    const shopifyProductId =
      typeof data.shopifyProductId === "string" && data.shopifyProductId.trim()
        ? data.shopifyProductId.trim()
        : null;

    if (!shopifyProductId) {
      skippedNoShopifyId += 1;
      continue;
    }

    try {
      const urls = await fetchShopifyImages(shopifyProductId);

      if (!urls.length) {
        noShopifyImages += 1;
        continue;
      }

      await docSnap.ref.set(
        {
          image: urls[0] || null,
          images: urls,
          imageUrls: urls,
          updatedAt: Date.now(),
        },
        { merge: true },
      );

      updated += 1;
      console.log(`Updated ${docSnap.id} -> ${urls.length} image(s)`);
    } catch (err) {
      failed += 1;
      console.error(`Failed ${docSnap.id}:`, err?.message || err);
    }
  }

  console.log({
    checked,
    alreadyHadImages,
    missing,
    updated,
    skippedNoShopifyId,
    noShopifyImages,
    failed,
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
