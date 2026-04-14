# DRIPSTR AI Stylist

AI-powered fashion recommendation experience built for **Drippr**.  
DRIPSTR guides shoppers through a quick styling flow, understands their vibe, category, occasion, and budget, validates an optional full-body photo, and returns curated product recommendations from the store catalog.

---

## Highlights

- Guided 6-step styling flow
- Optional full-body photo validation
- Quick photo-based style snapshot
- Dynamic category suggestions
- Budget-based filtering
- Vibe + category recommendation engine
- Sold-out product handling
- View in store support
- Bag handoff integration
- Mobile-first branded UI

---

## Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide Icons

**Backend**
- Vercel Serverless Functions
- TypeScript
- Zod

**Integrations**
- Shopify
- Firebase / Firestore
- MediaPipe

---

## User Flow

1. Select gender
2. Upload or skip full-body photo
3. Pick a vibe
4. Choose a category
5. Enter occasion details
6. Select budget
7. Get curated recommendations

---

## Budget Buckets

- ₹0 - ₹499
- ₹500 - ₹999
- ₹1,000 - ₹1,499
- ₹1,500 - ₹1,999
- ₹2,000 - ₹2,499
- ₹2,500 & above

---

## Features

### Styling Flow
- Smooth multi-step onboarding
- Fast transitions
- Dynamic category loading
- Occasion prompt input
- Curated result section

### Photo Step
- Full-body validation
- Single-person check
- Framing / pose understanding
- Style snapshot:
  - Skin tone label
  - Body frame label
  - Pose label

### Recommendations
- Gender-aware filtering
- Category relevance scoring
- Vibe keyword matching
- Budget filtering
- Sold-out sorting and handling

### Store Integration
- Product detail linking
- Add-to-bag support
- Store handoff flow
- Shopify storefront popup support

---

## Project Structure

```bash
.
├── api/
│   ├── recommend.ts
│   ├── category-options.ts
│   └── _lib/
│       ├── recommendation.ts
│       ├── schemas.ts
│       ├── shopifyCatalog.ts
│       └── ...
├── src/
│   ├── components/
│   │   └── StyleConcierge/
│   │       ├── TopBar.tsx
│   │       ├── Hero.tsx
│   │       ├── StepCard.tsx
│   │       ├── ResultsSection.tsx
│   │       ├── ProductCard.tsx
│   │       └── CuratingLoader.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── aiBag.ts
│   │   ├── photoValidation.ts
│   │   └── ...
│   ├── pages/
│   │   └── Index.tsx
│   ├── types/
│   │   └── recommendation.ts
│   └── ...
├── public/
├── index.html
├── package.json
└── README.md
