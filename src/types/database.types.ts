export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id">>;
      };
      food_scans: {
        Row: FoodScan;
        Insert: Omit<FoodScan, "id" | "created_at">;
        Update: Partial<Omit<FoodScan, "id">>;
      };
      streaks: {
        Row: Streak;
        Insert: Omit<Streak, "id" | "created_at">;
        Update: Partial<Omit<Streak, "id">>;
      };
      user_plans: {
        Row: UserPlan;
        Insert: Omit<UserPlan, "id" | "created_at">;
        Update: Partial<Omit<UserPlan, "id">>;
      };
      ai_conversations: {
        Row: AiConversation;
        Insert: Omit<AiConversation, "id" | "created_at">;
        Update: Partial<Omit<AiConversation, "id">>;
      };
      plan_recipes: {
        Row: PlanRecipe;
        Insert: Omit<PlanRecipe, "id" | "created_at">;
        Update: Partial<Omit<PlanRecipe, "id">>;
      };
      medical_documents: {
        Row: MedicalDocument;
        Insert: Omit<MedicalDocument, "id" | "created_at">;
        Update: Partial<Omit<MedicalDocument, "id">>;
      };
      auto_export_settings: {
        Row: AutoExportSetting;
        Insert: Omit<AutoExportSetting, "id" | "created_at">;
        Update: Partial<Omit<AutoExportSetting, "id">>;
      };
    };
  };
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  daily_scan_count: number;
  last_scan_date: string | null;
  sugar_free_streak: number;
  created_at: string;
  updated_at: string;
}

export interface FoodScan {
  id: string;
  user_id: string;
  scan_type: "barcode" | "photo" | "manual";
  barcode: string | null;
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
  ai_analysis: Json | null;
  is_sugar_free: boolean;
  created_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  date: string;
  is_sugar_free: boolean;
  notes: string | null;
  created_at: string;
}

export interface UserPlan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  plan_data: Json;
  ai_generated: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AiConversation {
  id: string;
  user_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Json | null;
  created_at: string;
}

export interface PlanRecipe {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  ingredients: Json;
  instructions: string | null;
  calories: number | null;
  sugar_grams: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  created_at: string;
}

export interface MedicalDocument {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  page_count: number | null;
  created_at: string;
}

export interface AutoExportSetting {
  id: string;
  user_id: string;
  enabled: boolean;
  frequency: string;
  export_time: number;
  email: string;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}
