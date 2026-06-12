import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { theme } from "../config/theme";

interface LoadingSpinnerProps {
  /** Show as full-screen centered overlay */
  fullScreen?: boolean;
  /** Spinner size */
  size?: "small" | "large";
  /** Spinner color (default: app primary) */
  color?: string;
  /** Optional label shown below the spinner */
  label?: string;
  /** Background style for full-screen mode */
  variant?: "default" | "overlay" | "transparent";
}

export function LoadingSpinner({
  fullScreen = false,
  size = "large",
  color = theme.colors.primary,
  label,
  variant = "default",
}: LoadingSpinnerProps) {
  if (fullScreen) {
    const bgColor =
      variant === "overlay"
        ? theme.colors.overlay
        : variant === "transparent"
          ? "transparent"
          : theme.colors.background;

    return (
      <View style={[styles.fullScreen, { backgroundColor: bgColor }]}>
        <ActivityIndicator size={size} color={color} />
        {label && <Text style={styles.label}>{label}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={color} />
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inline: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    marginTop: 12,
  },
});
