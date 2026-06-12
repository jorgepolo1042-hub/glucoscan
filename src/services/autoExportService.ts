import { supabase } from "../lib/supabase";

export type AutoExportFrequency = "daily" | "weekly";

export interface AutoExportSettings {
  id: string;
  user_id: string;
  enabled: boolean;
  frequency: AutoExportFrequency;
  export_time: number; // hour in UTC (0-23)
  email: string;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAutoExportSettings(
  userId: string
): Promise<AutoExportSettings | null> {
  const { data, error } = await supabase
    .from("auto_export_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch auto-export settings:", error.message);
    return null;
  }

  return data;
}

export async function saveAutoExportSettings(
  userId: string,
  settings: {
    enabled: boolean;
    frequency: AutoExportFrequency;
    export_time: number;
    email: string;
  }
): Promise<void> {
  const { error } = await supabase.from("auto_export_settings").upsert(
    {
      user_id: userId,
      enabled: settings.enabled,
      frequency: settings.frequency,
      export_time: settings.export_time,
      email: settings.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to save auto-export settings: ${error.message}`);
  }
}

export async function deleteAutoExportSettings(userId: string): Promise<void> {
  const { error } = await supabase
    .from("auto_export_settings")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete auto-export settings:", error.message);
  }
}
