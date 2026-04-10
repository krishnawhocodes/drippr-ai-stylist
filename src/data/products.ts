export interface Product {
  id: number;
  name: string;
  gender: "Women" | "Men";
  vibe: string;
  category: string;
  price: number;
  imageUrl: string;
  reason: string;
}

export const products: Product[] = [
  { id: 1, name: "Oversized Cargo Joggers", gender: "Men", vibe: "Streetwear", category: "Cargo & Pants", price: 449, imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop", reason: "Matches your vibe + relaxed silhouette." },
  { id: 2, name: "Washed Cotton Tee", gender: "Men", vibe: "Minimal", category: "Tees", price: 249, imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop", reason: "Clean lines, effortless pairing." },
  { id: 3, name: "Cropped Hoodie", gender: "Women", vibe: "Streetwear", category: "Sweatshirts & Hoodies", price: 599, imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop", reason: "Statement piece with street edge." },
  { id: 4, name: "Linen Blend Shorts", gender: "Men", vibe: "Daily", category: "Shorts & Skirts", price: 349, imageUrl: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=500&fit=crop", reason: "Breathable comfort, everyday wear." },
  { id: 5, name: "Ribbed Tank Dress", gender: "Women", vibe: "Minimal", category: "Tops & Dresses", price: 499, imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop", reason: "Effortless silhouette, tonal styling." },
  { id: 6, name: "Utility Jacket", gender: "Men", vibe: "Streetwear", category: "Jackets", price: 899, imageUrl: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=500&fit=crop", reason: "Layering essential with edge." },
  { id: 7, name: "Vintage Graphic Tee", gender: "Women", vibe: "Thrift", category: "Tees", price: 199, imageUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=500&fit=crop", reason: "Pre-loved aesthetic, curated find." },
  { id: 8, name: "Track Pants", gender: "Men", vibe: "Athleisure", category: "Cargo & Pants", price: 399, imageUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400&h=500&fit=crop", reason: "Sport-to-street crossover." },
  { id: 9, name: "Cord Set — Earth", gender: "Women", vibe: "Fusion", category: "Cord Set", price: 749, imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop", reason: "Co-ord set with cultural flair." },
  { id: 10, name: "Slim Chinos", gender: "Men", vibe: "Minimal", category: "Cargo & Pants", price: 549, imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=500&fit=crop", reason: "Tailored fit, versatile base." },
  { id: 11, name: "Puff Sleeve Blouse", gender: "Women", vibe: "Daily", category: "Tops & Dresses", price: 399, imageUrl: "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=400&h=500&fit=crop", reason: "Soft structure for everyday polish." },
  { id: 12, name: "Denim Trucker Jacket", gender: "Men", vibe: "Thrift", category: "Jackets", price: 699, imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop", reason: "Timeless layer, worn-in charm." },
  { id: 13, name: "Mesh Panel Sports Bra", gender: "Women", vibe: "Athleisure", category: "Tops & Dresses", price: 279, imageUrl: "https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=400&h=500&fit=crop", reason: "Performance meets street style." },
  { id: 14, name: "Pleated Mini Skirt", gender: "Women", vibe: "Streetwear", category: "Shorts & Skirts", price: 349, imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=500&fit=crop", reason: "Bold pairing, statement bottom." },
  { id: 15, name: "Oversized Hoodie", gender: "Men", vibe: "Streetwear", category: "Sweatshirts & Hoodies", price: 549, imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop", reason: "Relaxed drape, layering staple." },
  { id: 16, name: "Knit Polo Shirt", gender: "Men", vibe: "Daily", category: "Tees", price: 449, imageUrl: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&h=500&fit=crop", reason: "Smart-casual anchor piece." },
  { id: 17, name: "Wrap Midi Dress", gender: "Women", vibe: "Fusion", category: "Tops & Dresses", price: 599, imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop", reason: "Contemporary drape, cultural mix." },
  { id: 18, name: "Running Shorts", gender: "Men", vibe: "Athleisure", category: "Shorts & Skirts", price: 249, imageUrl: "https://images.unsplash.com/photo-1519058082700-08a0b56da9b4?w=400&h=500&fit=crop", reason: "Lightweight, dual-purpose cut." },
  { id: 19, name: "Vintage Windbreaker", gender: "Women", vibe: "Thrift", category: "Jackets", price: 399, imageUrl: "https://images.unsplash.com/photo-1544957992-20514f595d6f?w=400&h=500&fit=crop", reason: "Retro silhouette, curated palette." },
  { id: 20, name: "Cropped Cardigan", gender: "Women", vibe: "Minimal", category: "Tops & Dresses", price: 449, imageUrl: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=400&h=500&fit=crop", reason: "Layering essential, clean proportions." },
  { id: 21, name: "Cargo Shorts", gender: "Men", vibe: "Streetwear", category: "Shorts & Skirts", price: 399, imageUrl: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=500&fit=crop", reason: "Utility pockets, street-ready cut." },
  { id: 22, name: "Block Print Kurta Set", gender: "Women", vibe: "Fusion", category: "Cord Set", price: 649, imageUrl: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400&h=500&fit=crop", reason: "Heritage print, modern styling." },
  { id: 23, name: "Heavyweight Sweatshirt", gender: "Men", vibe: "Daily", category: "Sweatshirts & Hoodies", price: 499, imageUrl: "https://images.unsplash.com/photo-1578768079470-f8e97e87e975?w=400&h=500&fit=crop", reason: "Substantial weight, everyday warmth." },
  { id: 24, name: "Satin Slip Dress", gender: "Women", vibe: "Minimal", category: "Tops & Dresses", price: 549, imageUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=500&fit=crop", reason: "Understated elegance, fluid drape." },
  { id: 25, name: "Tech Joggers", gender: "Men", vibe: "Athleisure", category: "Cargo & Pants", price: 549, imageUrl: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&h=500&fit=crop", reason: "Technical fabric, tapered fit." },
  { id: 26, name: "Patchwork Denim Jacket", gender: "Women", vibe: "Thrift", category: "Jackets", price: 599, imageUrl: "https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=400&h=500&fit=crop", reason: "One-of-a-kind, curated patchwork." },
  { id: 27, name: "Striped Tee", gender: "Men", vibe: "Minimal", category: "Tees", price: 299, imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=500&fit=crop", reason: "Timeless pattern, clean palette." },
  { id: 28, name: "Wide Leg Trousers", gender: "Women", vibe: "Daily", category: "Cargo & Pants", price: 499, imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop", reason: "Flowing silhouette, daily comfort." },
  { id: 29, name: "Bomber Jacket", gender: "Men", vibe: "Streetwear", category: "Jackets", price: 799, imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop", reason: "Iconic shape, street-forward." },
  { id: 30, name: "Athleisure Crop Top", gender: "Women", vibe: "Athleisure", category: "Tops & Dresses", price: 249, imageUrl: "https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=400&h=500&fit=crop", reason: "Studio to street transition." },
  { id: 31, name: "Corduroy Overshirt", gender: "Men", vibe: "Thrift", category: "Jackets", price: 549, imageUrl: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&h=500&fit=crop", reason: "Textured layering, vintage tone." },
  { id: 32, name: "Embroidered Kurta", gender: "Men", vibe: "Fusion", category: "Cord Set", price: 599, imageUrl: "https://images.unsplash.com/photo-1583391733981-8b530e07ef14?w=400&h=500&fit=crop", reason: "Heritage craft meets modern cut." },
];
