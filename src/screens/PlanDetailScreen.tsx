import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import type { PlanWithRecipes, PlanRecipe } from "../services/planService";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

interface PlanDetailScreenProps {
  plan: PlanWithRecipes;
  onClose: () => void;
}

function RecipeCard({ recipe, isExpanded, onToggle }: {
  recipe: PlanRecipe;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const sugarSafe = recipe.sugar_grams != null && recipe.sugar_grams < 5;
  const sugarModerate = recipe.sugar_grams != null && recipe.sugar_grams >= 5 && recipe.sugar_grams < 15;

  return (
    <View style={styles.recipeCard}>
      <Pressable
        style={({ pressed }) => [styles.recipeHeader, pressed && { opacity: 0.7 }]}
        onPress={onToggle}
      >
        <View style={styles.recipeHeaderLeft}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          {recipe.description && (
            <Text style={styles.recipeDesc} numberOfLines={isExpanded ? undefined : 1}>
              {recipe.description}
            </Text>
          )}
        </View>
        <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
      </Pressable>

      <View style={styles.recipeNutritionRow}>
        {recipe.calories != null && (
          <View style={styles.miniNut}>
            <Text style={styles.miniNutValue}>{recipe.calories}</Text>
            <Text style={styles.miniNutLabel}>kcal</Text>
          </View>
        )}
        {recipe.protein_grams != null && (
          <View style={styles.miniNut}>
            <Text style={styles.miniNutValue}>{recipe.protein_grams}g</Text>
            <Text style={styles.miniNutLabel}>protein</Text>
          </View>
        )}
        {recipe.carbs_grams != null && (
          <View style={styles.miniNut}>
            <Text style={styles.miniNutValue}>{recipe.carbs_grams}g</Text>
            <Text style={styles.miniNutLabel}>carbs</Text>
          </View>
        )}
        {recipe.fat_grams != null && (
          <View style={styles.miniNut}>
            <Text style={styles.miniNutValue}>{recipe.fat_grams}g</Text>
            <Text style={styles.miniNutLabel}>fat</Text>
          </View>
        )}
        <View style={[styles.sugarBadge, sugarSafe ? styles.sugarSafe : sugarModerate ? styles.sugarModerate : styles.sugarHigh]}>
          <Text style={styles.sugarBadgeText}>
            {recipe.sugar_grams != null ? `${recipe.sugar_grams}g sugar` : "?"}
          </Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.recipeExpanded}>
          {recipe.ingredients.length > 0 && (
            <View style={styles.expandedSection}>
              <Text style={styles.expandedSectionTitle}>🥕 Ingredients</Text>
              {recipe.ingredients.map((ing, i) => (
                <Text key={i} style={styles.listItem}>• {ing}</Text>
              ))}
            </View>
          )}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={styles.expandedSection}>
              <Text style={styles.expandedSectionTitle}>👨‍🍳 Instructions</Text>
              {recipe.instructions.map((step, i) => (
                <Text key={i} style={styles.listItem}>{i + 1}. {step}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function PlanDetailScreen({ plan, onClose }: PlanDetailScreenProps) {
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  const totalCalories = plan.recipes.reduce((sum, r) => sum + (r.calories ?? 0), 0);
  const totalSugar = plan.recipes.reduce((sum, r) => sum + (r.sugar_grams ?? 0), 0);
  const totalProtein = plan.recipes.reduce((sum, r) => sum + (r.protein_grams ?? 0), 0);
  const totalCarbs = plan.recipes.reduce((sum, r) => sum + (r.carbs_grams ?? 0), 0);

  return (
    <View style={styles.container}>
      <ScreenHeader title={plan.title} onClose={onClose} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Plan overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>{plan.title}</Text>
          {plan.description && <Text style={styles.overviewDesc}>{plan.description}</Text>}

          <View style={styles.dailyTotals}>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{totalCalories}</Text>
              <Text style={styles.totalLabel}>kcal / day</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={[styles.totalValue, totalSugar < 15 ? styles.totalGood : styles.totalWarn]}>
                {totalSugar}g
              </Text>
              <Text style={styles.totalLabel}>sugar / day</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{totalProtein}g</Text>
              <Text style={styles.totalLabel}>protein</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{totalCarbs}g</Text>
              <Text style={styles.totalLabel}>carbs</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>🍽️ {plan.recipes.length} Recipes</Text>

        {plan.recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            isExpanded={expandedRecipe === recipe.id}
            onToggle={() => setExpandedRecipe(expandedRecipe === recipe.id ? null : recipe.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Header provided by ScreenHeader component
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },

  overviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl, padding: 20, marginBottom: 20,
    ...theme.shadow.md,
  },
  overviewTitle: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  overviewDesc: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  dailyTotals: { flexDirection: "row", gap: 8 },
  totalItem: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
  totalValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "800" },
  totalGood: { color: theme.colors.success },
  totalWarn: { color: theme.colors.danger },
  totalLabel: { color: theme.colors.textTertiary, fontSize: 10, marginTop: 2, textAlign: "center" },

  sectionTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 12 },

  recipeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, marginBottom: 12, overflow: "hidden",
    ...theme.shadow.sm,
  },
  recipeHeader: { flexDirection: "row", padding: 16, gap: 8 },
  recipeHeaderLeft: { flex: 1 },
  recipeName: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  recipeDesc: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  expandIcon: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 4 },
  recipeNutritionRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexWrap: "wrap" },
  miniNut: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.sm, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center" },
  miniNutValue: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" },
  miniNutLabel: { color: theme.colors.textTertiary, fontSize: 10 },
  sugarBadge: { borderRadius: theme.radius.sm, paddingVertical: 6, paddingHorizontal: 10, justifyContent: "center" },
  sugarSafe: { backgroundColor: theme.colors.success },
  sugarModerate: { backgroundColor: theme.colors.warning },
  sugarHigh: { backgroundColor: theme.colors.danger },
  sugarBadgeText: { color: theme.colors.textInverse, fontSize: 13, fontWeight: "600" },

  recipeExpanded: { borderTopWidth: 1, borderTopColor: theme.colors.border, padding: 16 },
  expandedSection: { marginBottom: 16 },
  expandedSectionTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  listItem: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22, paddingLeft: 4 },
});
