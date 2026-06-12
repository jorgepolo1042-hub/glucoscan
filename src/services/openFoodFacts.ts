export interface OFFProduct {
  product_name: string | null;
  brand: string | null;
  calories: number | null;
  sugar_grams: number | null;
  carbs_grams: number | null;
  protein_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  image_url: string | null;
  ingredients: string | null;
  nutritional_score: string | null;
  is_sugar_free: boolean;
}

interface OFFNutriments {
  "energy-kcal_100g"?: number;
  sugars_100g?: number;
  carbohydrates_100g?: number;
  proteins_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  ["energy-kcal"]?: number;
  sugars?: number;
  carbohydrates?: number;
  proteins?: number;
  fat?: number;
  fiber?: number;
}

interface OFFProductResponse {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    nutriments?: OFFNutriments;
    image_url?: string;
    ingredients_text?: string;
    nutrition_grades?: string;
  };
}

const OFF_API_BASE = "https://world.openfoodfacts.net/api/v2";
const USER_AGENT = "GlucoScan - ExpoApp - Version 1.0";

function extractNutrimentValue(
  nutriments: OFFNutriments | undefined,
  per100gKey: string,
  absoluteKey: string
): number | null {
  if (!nutriments) return null;
  const value = nutriments[per100gKey as keyof OFFNutriments] ?? nutriments[absoluteKey as keyof OFFNutriments];
  return value != null ? Math.round(value) : null;
}

export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  const url = `${OFF_API_BASE}/product/${barcode}?fields=product_name,brands,nutriments,image_url,ingredients_text,nutrition_grades`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(`Open Food Facts error: ${response.status}`);
  }

  const data: OFFProductResponse = await response.json();

  if (data.status !== 1 || !data.product) {
    return null;
  }

  const p = data.product;
  const n = p.nutriments;

  const sugarGrams = extractNutrimentValue(n, "sugars_100g", "sugars");

  return {
    product_name: p.product_name ?? null,
    brand: p.brands ?? null,
    calories: extractNutrimentValue(n, "energy-kcal_100g", "energy-kcal"),
    sugar_grams: sugarGrams,
    carbs_grams: extractNutrimentValue(n, "carbohydrates_100g", "carbohydrates"),
    protein_grams: extractNutrimentValue(n, "proteins_100g", "proteins"),
    fat_grams: extractNutrimentValue(n, "fat_100g", "fat"),
    fiber_grams: extractNutrimentValue(n, "fiber_100g", "fiber"),
    image_url: p.image_url ?? null,
    ingredients: p.ingredients_text ?? null,
    nutritional_score: p.nutrition_grades ?? null,
    is_sugar_free: sugarGrams != null ? sugarGrams <= 0.5 : false,
  };
}
