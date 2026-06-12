import * as FileSystem from "expo-file-system";

export interface OpenAiAnalysis {
  productName: string;
  estimatedCalories: number | null;
  estimatedSugarGrams: number | null;
  estimatedCarbsGrams: number | null;
  estimatedProteinGrams: number | null;
  estimatedFatGrams: number | null;
  isSugarFree: boolean;
  description: string;
  rawResponse: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";
const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a nutritional analysis AI for an app called GlucoScan, designed for diabetic users.
Analyze the food in the image and return a JSON object with the following fields:
- productName: name of the food/dish
- estimatedCalories: estimated calories per serving (number or null)
- estimatedSugarGrams: estimated sugar in grams per serving (number or null)
- estimatedCarbsGrams: estimated carbohydrates in grams per serving (number or null)
- estimatedProteinGrams: estimated protein in grams per serving (number or null)
- estimatedFatGrams: estimated fat in grams per serving (number or null)
- isSugarFree: boolean, true if the food has 0.5g sugar or less per serving
- description: a brief description of what you see in the image
IMPORTANT: Respond ONLY with the JSON object, no markdown, no code blocks.`;

async function imageToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

export async function analyzeFoodImage(imageUri: string): Promise<OpenAiAnalysis> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.");
  }

  const base64Image = await imageToBase64(imageUri);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this food item for nutritional information. Return only JSON.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      productName: parsed.productName ?? "Unknown food",
      estimatedCalories: parsed.estimatedCalories ?? null,
      estimatedSugarGrams: parsed.estimatedSugarGrams ?? null,
      estimatedCarbsGrams: parsed.estimatedCarbsGrams ?? null,
      estimatedProteinGrams: parsed.estimatedProteinGrams ?? null,
      estimatedFatGrams: parsed.estimatedFatGrams ?? null,
      isSugarFree: parsed.isSugarFree ?? false,
      description: parsed.description ?? "",
      rawResponse: content,
    };
  } catch {
    return {
      productName: "Unknown food",
      estimatedCalories: null,
      estimatedSugarGrams: null,
      estimatedCarbsGrams: null,
      estimatedProteinGrams: null,
      estimatedFatGrams: null,
      isSugarFree: false,
      description: "Could not parse AI analysis",
      rawResponse: content,
    };
  }
}
