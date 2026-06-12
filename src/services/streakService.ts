import { supabase } from "../lib/supabase";

export interface StreakEntry {
  id: string;
  user_id: string;
  date: string;
  is_sugar_free: boolean;
  notes: string | null;
  created_at: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayCheckedIn: boolean;
  todayIsSugarFree: boolean;
  lastCheckInDate: string | null;
  streakHistory: StreakEntry[];
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

function calculateStreak(entries: StreakEntry[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (entries.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get all sugar-free days sorted ascending
  const sugarFreeDays = entries
    .filter((e) => e.is_sugar_free)
    .map((e) => e.date)
    .sort()
    .filter(Boolean);

  if (sugarFreeDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Longest streak: count consecutive dates
  let tempRun = 1;
  let longestStreak = 1;

  for (let i = 1; i < sugarFreeDays.length; i++) {
    const prev = new Date(sugarFreeDays[i - 1]);
    const curr = new Date(sugarFreeDays[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      tempRun++;
      longestStreak = Math.max(longestStreak, tempRun);
    } else {
      tempRun = 1;
    }
  }

  // Current streak: count consecutive sugar-free days ending today or yesterday
  const today = getTodayDate();
  const yesterday = getDateNDaysAgo(1);
  const mostRecentDate = sugarFreeDays[sugarFreeDays.length - 1];

  // Streak must end today or yesterday
  if (mostRecentDate !== today && mostRecentDate !== yesterday) {
    return { currentStreak: 0, longestStreak };
  }

  // Count backwards from the most recent
  let currentStreak = 0;
  for (let i = sugarFreeDays.length - 1; i >= 0; i--) {
    const expectedDate = toDateStr(
      new Date(new Date(mostRecentDate).getTime() - currentStreak * 86400000)
    );
    if (sugarFreeDays[i] !== expectedDate) break;
    currentStreak++;
  }

  return { currentStreak, longestStreak };
}

function toStreakEntry(raw: Record<string, unknown>): StreakEntry {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    date: raw.date as string,
    is_sugar_free: raw.is_sugar_free as boolean,
    notes: raw.notes as string | null,
    created_at: raw.created_at as string,
  };
}

export async function getStreakData(userId: string): Promise<StreakData> {
  const ninetyDaysAgo = getDateNDaysAgo(90);

  const { data, error } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .gte("date", ninetyDaysAgo)
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch streaks: ${error.message}`);
  }

  const entries = ((data ?? []) as Record<string, unknown>[]).map(toStreakEntry);
  const today = getTodayDate();
  const todayEntry = entries.find((e) => e.date === today);
  const mostRecent = entries[0];

  const { currentStreak, longestStreak } = calculateStreak(entries);

  return {
    currentStreak,
    longestStreak,
    todayCheckedIn: !!todayEntry,
    todayIsSugarFree: todayEntry?.is_sugar_free ?? false,
    lastCheckInDate: mostRecent?.date ?? null,
    streakHistory: entries,
  };
}

export async function checkInToday(
  userId: string,
  isSugarFree: boolean,
  notes?: string
): Promise<StreakEntry> {
  const today = getTodayDate();

  const { data, error } = await supabase
    .from("streaks")
    .upsert(
      {
        user_id: userId,
        date: today,
        is_sugar_free: isSugarFree,
        notes: notes ?? null,
      },
      {
        onConflict: "user_id, date",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to check in: ${error.message}`);
  }

  return toStreakEntry(data as Record<string, unknown>);
}

export async function autoCheckInFromScans(
  userId: string
): Promise<StreakEntry | null> {
  const today = getTodayDate();

  // Check if already checked in today
  const { data: existing } = await supabase
    .from("streaks")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (existing) return null; // Already checked in manually

  // Get all food scans from today
  const { data: scans, error } = await supabase
    .from("food_scans")
    .select("is_sugar_free")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00.000Z`);

  if (error) throw new Error(`Failed to fetch today's scans: ${error.message}`);

  if (!scans || scans.length === 0) return null;

  const allSugarFree = (scans as { is_sugar_free: boolean }[]).every(
    (s) => s.is_sugar_free
  );

  return checkInToday(userId, allSugarFree, "Auto-detected from food scans");
}
