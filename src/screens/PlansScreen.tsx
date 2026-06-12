import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  getUserPlans,
  generatePlan,
  activatePlan,
  deletePlan,
  getDefaultPreferences,
  type UserPlan,
  type PlanPreferences,
  type PlanWithRecipes,
} from "../services/planService";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

interface PlansScreenProps {
  onClose: () => void;
  onViewPlan: (plan: PlanWithRecipes) => void;
  userId: string | null;
}

type ScreenState =
  | { type: "list" }
  | { type: "generating" }
  | { type: "form" };

const GOALS: { key: PlanPreferences["goal"]; label: string }[] = [
  { key: "blood_sugar_control", label: "Blood Sugar Control" },
  { key: "weight_loss", label: "Weight Loss" },
  { key: "maintain", label: "Maintain" },
  { key: "muscle_gain", label: "Muscle Gain" },
];

const DIETS: { key: PlanPreferences["dietType"]; label: string }[] = [
  { key: "low_carb", label: "Low Carb" },
  { key: "balanced", label: "Balanced" },
  { key: "keto", label: "Keto" },
  { key: "mediterranean", label: "Mediterranean" },
  { key: "vegetarian", label: "Vegetarian" },
];

export function PlansScreen({ onClose, onViewPlan, userId }: PlansScreenProps) {
  const [plans, setPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenState, setScreenState] = useState<ScreenState>({ type: "list" });
  const [form, setForm] = useState<PlanPreferences>(getDefaultPreferences());

  const loadPlans = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getUserPlans(userId);
      setPlans(data);
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setScreenState({ type: "generating" });
    try {
      const plan = await generatePlan(userId, form);
      setPlans((prev) => [plan, ...prev]);
      onViewPlan(plan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Generation failed";
      Alert.alert("Error", msg);
      setScreenState({ type: "form" });
    }
  }, [userId, form, onViewPlan]);

  const handleActivate = useCallback(async (planId: string) => {
    if (!userId) return;
    try {
      await activatePlan(userId, planId);
      loadPlans();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed";
      Alert.alert("Error", msg);
    }
  }, [userId, loadPlans]);

  const handleDelete = useCallback(async (planId: string) => {
    Alert.alert("Delete Plan", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deletePlan(planId);
            loadPlans();
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed";
            Alert.alert("Error", msg);
          }
        },
      },
    ]);
  }, [loadPlans]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner fullScreen color={theme.colors.primary} />
      </View>
    );
  }

  if (screenState.type === "generating") {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner fullScreen color={theme.colors.primary} label="🧠 Generating Your Plan" />
        <Text style={styles.generatingSub}>AI is creating personalized recipes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Meal Plans" icon="📋" onClose={onClose} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {screenState.type === "form" ? (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Plan Preferences</Text>
            <Text style={styles.formSubtitle}>AI will create a personalized plan for your needs.</Text>

            <Text style={styles.fieldLabel}>Goal</Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => (
                <Pressable
                  key={g.key}
                  style={({ pressed }) => [styles.chip, form.goal === g.key && styles.chipActive, pressed && { opacity: 0.8 }]}
                  onPress={() => setForm((f) => ({ ...f, goal: g.key }))}
                >
                  <Text style={[styles.chipText, form.goal === g.key && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Diet Type</Text>
            <View style={styles.chipRow}>
              {DIETS.map((d) => (
                <Pressable
                  key={d.key}
                  style={({ pressed }) => [styles.chip, form.dietType === d.key && styles.chipActive, pressed && { opacity: 0.8 }]}
                  onPress={() => setForm((f) => ({ ...f, dietType: d.key }))}
                >
                  <Text style={[styles.chipText, form.dietType === d.key && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Meals per Day</Text>
            <View style={styles.chipRow}>
              {([3, 4, 5] as const).map((n) => (
                <Pressable
                  key={n}
                  style={({ pressed }) => [styles.chip, form.mealsPerDay === n && styles.chipActive, pressed && { opacity: 0.8 }]}
                  onPress={() => setForm((f) => ({ ...f, mealsPerDay: n }))}
                >
                  <Text style={[styles.chipText, form.mealsPerDay === n && styles.chipTextActive]}>{n} meals</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Daily Calorie Target (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 1800"
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="number-pad"
              value={form.calorieTarget?.toString() ?? ""}
              onChangeText={(t) => setForm((f) => ({ ...f, calorieTarget: t ? parseInt(t, 10) : null }))}
            />

            <Text style={styles.fieldLabel}>Restrictions</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. gluten-free, dairy-free, no nuts"
              placeholderTextColor={theme.colors.textTertiary}
              value={form.restrictions.join(", ")}
              onChangeText={(t) => setForm((f) => ({ ...f, restrictions: t.split(",").map((s) => s.trim()).filter(Boolean) }))}
            />

            <Text style={styles.fieldLabel}>Preferences</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. I love chicken, quick meals"
              placeholderTextColor={theme.colors.textTertiary}
              value={form.preferences.join(", ")}
              onChangeText={(t) => setForm((f) => ({ ...f, preferences: t.split(",").map((s) => s.trim()).filter(Boolean) }))}
            />

            <Pressable style={({ pressed }) => [styles.generateButton, pressed && { opacity: 0.8 }]} onPress={handleGenerate}>
              <Text style={styles.generateButtonText}>🤖 Generate Plan with AI</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.newPlanButton, pressed && { opacity: 0.8 }]}
              onPress={() => setScreenState({ type: "form" })}
            >
              <Text style={styles.newPlanIcon}>🤖</Text>
              <Text style={styles.newPlanText}>Generate New Plan</Text>
              <Text style={styles.newPlanSub}>AI creates personalized recipes just for you</Text>
            </Pressable>

            {plans.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No plans yet</Text>
                <Text style={styles.emptySub}>Generate your first AI meal plan above</Text>
              </View>
            )}

            {plans.map((plan) => (
              <Pressable
                key={plan.id}
                style={({ pressed }) => [styles.planCard, plan.is_active && styles.planCardActive, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  const { getPlanWithRecipes } = await import("../services/planService");
                  const full = await getPlanWithRecipes(plan.id);
                  if (full) onViewPlan(full);
                }}
              >
                <View style={styles.planCardHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  {plan.is_active && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
                {plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
                <View style={styles.planMeta}>
                  <Text style={styles.planDate}>{new Date(plan.created_at).toLocaleDateString()}</Text>
                  <Text style={styles.planAi}>{plan.ai_generated ? "🤖 AI" : "📝 Manual"}</Text>
                </View>
                <View style={styles.planActions}>
                  {!plan.is_active && (
                    <Pressable
                      style={({ pressed }) => [styles.activateBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => handleActivate(plan.id)}
                    >
                      <Text style={styles.activateBtnText}>Set as Active</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => handleDelete(plan.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background, padding: 24 },
  // Header provided by ScreenHeader component
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },
  generatingSub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 8 },

  newPlanButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl, padding: 24, alignItems: "center",
    marginBottom: 20, ...theme.shadow.md,
  },
  newPlanIcon: { fontSize: 36, marginBottom: 8 },
  newPlanText: { color: theme.colors.textInverse, fontSize: 18, fontWeight: "700" },
  newPlanSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },

  planCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 16, marginBottom: 12,
    ...theme.shadow.sm,
  },
  planCardActive: {
    borderWidth: 1.5, borderColor: theme.colors.primary,
  },
  planCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planTitle: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700", flex: 1 },
  activeBadge: { backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  activeBadgeText: { color: theme.colors.textInverse, fontSize: 11, fontWeight: "700" },
  planDesc: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
  planMeta: { flexDirection: "row", gap: 12, marginTop: 12 },
  planDate: { color: theme.colors.textTertiary, fontSize: 12 },
  planAi: { color: theme.colors.textTertiary, fontSize: 12 },
  planActions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  activateBtn: { flex: 1, backgroundColor: theme.colors.primary, paddingVertical: 8, borderRadius: theme.radius.md, alignItems: "center" },
  activateBtnText: { color: theme.colors.textInverse, fontSize: 13, fontWeight: "600" },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.danger },
  deleteBtnText: { color: theme.colors.danger, fontSize: 13, fontWeight: "600" },

  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptySub: { color: theme.colors.textTertiary, fontSize: 14, marginTop: 4 },

  formContainer: { paddingTop: 8 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  formSubtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 24 },
  fieldLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: theme.colors.textInverse, fontWeight: "700" },
  textInput: {
    backgroundColor: theme.colors.surface, color: theme.colors.textPrimary,
    borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: theme.colors.border,
  },
  generateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg, padding: 18, alignItems: "center",
    marginTop: 28, ...theme.shadow.md,
  },
  generateButtonText: { color: theme.colors.textInverse, fontSize: 17, fontWeight: "700" },
});
