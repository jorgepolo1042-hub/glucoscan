import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────

export interface PlanRecipeInput {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  calories: number;
  sugarGrams: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface PlanInput {
  title: string;
  description: string;
  recipes: PlanRecipeInput[];
}

export interface UserPlan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  plan_data: Record<string, unknown>;
  ai_generated: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PlanRecipe {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  instructions: string[] | null;
  calories: number | null;
  sugar_grams: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  created_at: string;
}

export interface PlanWithRecipes extends UserPlan {
  recipes: PlanRecipe[];
}

export interface PlanPreferences {
  goal: "weight_loss" | "maintain" | "muscle_gain" | "blood_sugar_control";
  dietType: "balanced" | "low_carb" | "keto" | "mediterranean" | "vegetarian";
  mealsPerDay: 3 | 4 | 5;
  calorieTarget: number | null;
  restrictions: string[];
  preferences: string[];
}

// ── OpenAI prompt ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a certified diabetic nutritionist AI for the app GlucoScan.
Generate a personalized Just-In-Time meal plan for a diabetic user.
The plan MUST be low glycemic index, low sugar, and nutritionally balanced.

Return a JSON object with this structure:
{
  "title": "string - catchy plan name",
  "description": "string - 2-3 sentence overview",
  "recipes": [
    {
      "name": "string - recipe name",
      "description": "string - short description",
      "ingredients": ["string ingredient with amounts"],
      "instructions": ["string step by step"],
      "calories": number,
      "sugarGrams": number,
      "proteinGrams": number,
      "carbsGrams": number,
      "fatGrams": number
    }
  ]
}

Generate 3-5 recipes per plan depending on mealsPerDay.
Every recipe must have sugarGrams < 15g. Prefer sugarGrams < 5g.
IMPORTANT: Respond ONLY with the JSON object, no markdown, no code blocks.`;

function buildUserPrompt(prefs: PlanPreferences): string {
  return `Generate a ${prefs.mealsPerDay}-meal ${prefs.dietType} meal plan for a diabetic user.
Goal: ${prefs.goal.replace(/_/g, " ")}
Diet type: ${prefs.dietType.replace(/_/g, " ")}
Meals per day: ${prefs.mealsPerDay}
${prefs.calorieTarget ? `Daily calorie target: ~${prefs.calorieTarget} kcal` : ""}
${prefs.restrictions.length ? `Restrictions: ${prefs.restrictions.join(", ")}` : ""}
${prefs.preferences.length ? `Preferences: ${prefs.preferences.join(", ")}` : ""}
Generate exactly ${prefs.mealsPerDay} recipes, one per meal.`;
}

// ── API call ───────────────────────────────────────────

async function generatePlanWithOpenAI(prompt: string): Promise<PlanInput> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.title || !parsed.recipes || !Array.isArray(parsed.recipes)) {
      throw new Error("Invalid plan structure from AI");
    }

    return {
      title: parsed.title,
      description: parsed.description ?? "",
      recipes: parsed.recipes.map(
        (r: Record<string, unknown>): PlanRecipeInput => ({
          name: r.name as string,
          description: (r.description as string) ?? "",
          ingredients: Array.isArray(r.ingredients)
            ? (r.ingredients as string[])
            : [],
          instructions: Array.isArray(r.instructions)
            ? (r.instructions as string[])
            : [],
          calories: (r.calories as number) ?? 0,
          sugarGrams: (r.sugarGrams as number) ?? 0,
          proteinGrams: (r.proteinGrams as number) ?? 0,
          carbsGrams: (r.carbsGrams as number) ?? 0,
          fatGrams: (r.fatGrams as number) ?? 0,
        })
      ),
    };
  } catch (e) {
    throw new Error(
      `Failed to parse AI response: ${e instanceof Error ? e.message : "Unknown"}`
    );
  }
}

// ── Persistence ────────────────────────────────────────

async function savePlan(
  userId: string,
  plan: PlanInput
): Promise<PlanWithRecipes> {
  // Insert plan
  const { data: planData, error: planError } = await supabase
    .from("user_plans")
    .insert({
      user_id: userId,
      title: plan.title,
      description: plan.description,
      plan_data: {},
      ai_generated: true,
      is_active: true,
    })
    .select()
    .single();

  if (planError || !planData) {
    throw new Error(`Failed to save plan: ${planError?.message}`);
  }

  const planId = planData.id;

  try {
    // Insert recipes
    const recipeRows = plan.recipes.map((r) => ({
      plan_id: planId,
      name: r.name,
      description: r.description,
      ingredients: r.ingredients,
      instructions: r.instructions,
      calories: r.calories,
      sugar_grams: r.sugarGrams,
      protein_grams: r.proteinGrams,
      carbs_grams: r.carbsGrams,
      fat_grams: r.fatGrams,
    }));

    const { data: recipesData, error: recipesError } = await supabase
      .from("plan_recipes")
      .insert(recipeRows)
      .select();

    if (recipesError) throw recipesError;

    return {
      ...(planData as unknown as UserPlan),
      recipes: (recipesData ?? []) as unknown as PlanRecipe[],
    };
  } catch (error) {
    // Cleanup: delete the plan if recipes failed
    await supabase.from("user_plans").delete().eq("id", planId);
    throw new Error(
      `Failed to save recipes: ${error instanceof Error ? error.message : "Unknown"}`
    );
  }
}

// ── Public API ─────────────────────────────────────────

export async function generatePlan(
  userId: string,
  preferences: PlanPreferences
): Promise<PlanWithRecipes> {
  const prompt = buildUserPrompt(preferences);
  const plan = await generatePlanWithOpenAI(prompt);
  return savePlan(userId, plan);
}

export async function getUserPlans(userId: string): Promise<UserPlan[]> {
  const { data, error } = await supabase
    .from("user_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch plans: ${error.message}`);
  return (data ?? []) as unknown as UserPlan[];
}

export async function getPlanWithRecipes(
  planId: string
): Promise<PlanWithRecipes | null> {
  const { data: plan, error: planError } = await supabase
    .from("user_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) return null;

  const { data: recipes } = await supabase
    .from("plan_recipes")
    .select("*")
    .eq("plan_id", planId)
    .order("calories", { ascending: false });

  return {
    ...(plan as unknown as UserPlan),
    recipes: (recipes ?? []) as unknown as PlanRecipe[],
  };
}

export async function activatePlan(
  userId: string,
  planId: string
): Promise<void> {
  // Deactivate all other plans, then activate this one
  await supabase
    .from("user_plans")
    .update({ is_active: false })
    .eq("user_id", userId);

  const { error } = await supabase
    .from("user_plans")
    .update({ is_active: true })
    .eq("id", planId);

  if (error) throw new Error(`Failed to activate plan: ${error.message}`);
}

export async function deletePlan(planId: string): Promise<void> {
  // Delete plan first — relies on DB cascade for recipes
  // (or recipes will be cleaned up by deletePlan's caller on error)
  const { error } = await supabase
    .from("user_plans")
    .delete()
    .eq("id", planId);

  if (error) throw new Error(`Failed to delete plan: ${error.message}`);

  // Clean up orphaned recipes just in case there's no cascade
  await supabase.from("plan_recipes").delete().eq("plan_id", planId);
}

export function getDefaultPreferences(): PlanPreferences {
  return {
    goal: "blood_sugar_control",
    dietType: "low_carb",
    mealsPerDay: 3,
    calorieTarget: null,
    restrictions: ["low sugar", "low glycemic index"],
    preferences: [],
  };
}
