import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { theme } from "../config/theme";
import type { ScanResult } from "./ScannerScreen";

interface ScanResultScreenProps {
  result: ScanResult;
  onSave: () => void;
  onRetake: () => void;
  isSaving: boolean;
}

function NutritionRow({
  label,
  value,
  unit,
  isHighlighted,
}: {
  label: string;
  value: string | number | null;
  unit: string;
  isHighlighted?: boolean;
}) {
  if (value == null) return null;
  return (
    <View style={[styles.nutritionRow, isHighlighted && styles.nutritionRowHighlighted]}>
      <Text style={styles.nutritionLabel}>{label}</Text>
      <Text style={[styles.nutritionValue, isHighlighted && styles.nutritionValueHighlighted]}>
        {value} {unit}
      </Text>
    </View>
  );
}

export function ScanResultScreen({
  result,
  onSave,
  onRetake,
  isSaving,
}: ScanResultScreenProps) {
  const { combinedResult } = result;
  if (!combinedResult) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>No product found</Text>
        <Text style={styles.subText}>
          {result.scanType === "barcode"
            ? "This barcode wasn't found in the database."
            : "Could not analyze the image."}
        </Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]} onPress={onRetake}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const sugarFree = combinedResult.isSugarFree;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(400)}>
          {/* Sugar-free badge */}
          {sugarFree && (
            <View style={styles.sugarFreeBadge}>
              <Text style={styles.sugarFreeText}>✅ Sugar-Free</Text>
            </View>
          )}
        </Animated.View>

        {/* Image */}
        {combinedResult.imageUrl && (
          <Animated.Image
            source={{ uri: combinedResult.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
            entering={FadeIn.duration(600)}
          />
        )}

        {/* Product name */}
        <Animated.View style={styles.productHeader} entering={FadeInDown.duration(500).delay(100)}>
          <Text style={styles.productName}>{combinedResult.productName}</Text>
          {combinedResult.brand && (
            <Text style={styles.brand}>{combinedResult.brand}</Text>
          )}
        </Animated.View>

        {/* Scan type indicator */}
        <Animated.View style={styles.scanTypeBadge} entering={FadeInDown.duration(500).delay(200)}>
          <Text style={styles.scanTypeText}>
            {result.scanType === "barcode" ? "📊 Barcode Scan" : "📸 AI Photo Analysis"}
          </Text>
        </Animated.View>

        {/* Nutritional info */}
        <Animated.View style={styles.nutritionCard} entering={FadeInDown.duration(500).delay(300)}>
          <Text style={styles.sectionTitle}>Nutrition Facts</Text>
          <View style={styles.nutritionDivider} />

          <NutritionRow label="Calories" value={combinedResult.calories} unit="kcal" />
          <NutritionRow
            label="Sugar"
            value={combinedResult.sugarGrams}
            unit="g"
            isHighlighted={!sugarFree && combinedResult.sugarGrams != null && combinedResult.sugarGrams > 0}
          />
          <NutritionRow label="Carbohydrates" value={combinedResult.carbsGrams} unit="g" />
          <NutritionRow label="Protein" value={combinedResult.proteinGrams} unit="g" />
          <NutritionRow label="Fat" value={combinedResult.fatGrams} unit="g" />
          <NutritionRow label="Fiber" value={combinedResult.fiberGrams} unit="g" />

          {combinedResult.nutritionalScore && (
            <>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Nutrition Grade</Text>
                <Text style={[styles.nutritionValue, styles.nutritionGrade]}>
                  {combinedResult.nutritionalScore.toUpperCase()}
                </Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Ingredients */}
        {combinedResult.ingredients && (
          <Animated.View style={styles.ingredientsCard} entering={FadeInDown.duration(500).delay(400)}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.ingredientsText}>
              {combinedResult.ingredients}
            </Text>
          </Animated.View>
        )}

        {/* AI analysis note */}
        {result.photoAnalysis && (
          <Animated.View style={styles.aiNote} entering={FadeInDown.duration(500).delay(500)}>
            <Text style={styles.aiNoteTitle}>🤖 AI Analysis</Text>
            <Text style={styles.aiNoteText}>{result.photoAnalysis.description}</Text>
            <Text style={styles.aiDisclaimer}>
              * AI estimations are approximate. Always verify with product labels.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && !isSaving && { opacity: 0.7 }]}
          onPress={onRetake}
          disabled={isSaving}
        >
          <Text style={styles.secondaryButtonText}>Retake</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton, styles.saveButton,
            isSaving && styles.disabledButton,
            pressed && !isSaving && { opacity: 0.8 },
          ]}
          onPress={onSave}
          disabled={isSaving}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Save Scan"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Badge
  sugarFreeBadge: {
    backgroundColor: theme.colors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  sugarFreeText: {
    color: theme.colors.textInverse,
    fontSize: 15,
    fontWeight: "700",
  },

  // Image
  productImage: {
    width: "100%",
    height: 280,
  },

  // Product info
  productHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  productName: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  brand: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },

  // Scan type badge
  scanTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  scanTypeText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Nutrition card
  nutritionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    ...theme.shadow.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  nutritionRowHighlighted: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  nutritionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  nutritionValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  nutritionValueHighlighted: {
    color: theme.colors.danger,
  },
  nutritionGrade: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },

  // Ingredients
  ingredientsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    ...theme.shadow.sm,
  },
  ingredientsText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  // AI note
  aiNote: {
    backgroundColor: "#EFF6FF",
    borderRadius: theme.radius.xl,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  aiNoteTitle: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  aiNoteText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  aiDisclaimer: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },

  // Bottom actions
  bottomActions: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  saveButton: { flex: 1 },

  // Buttons
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: theme.radius.lg,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  disabledButton: { opacity: 0.5 },

  // Error state
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  subText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
});
