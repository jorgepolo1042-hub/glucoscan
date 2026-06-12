import React, { useCallback } from "react";
import {
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  type WithSpringConfig,
} from "react-native-reanimated";
import { theme } from "../../config/theme";

const SPRING_CONFIG: WithSpringConfig = {
  damping: 12,
  mass: 0.5,
  stiffness: 200,
};

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function AnimatedButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);

  const tapGesture = Gesture.Tap()
    .enabled(!disabled && !loading)
    .onBegin(() => {
      scale.value = withSpring(0.94, SPRING_CONFIG);
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
      if (!disabled && !loading) {
        // We call onPress in the callback since onEnd doesn't always fire
      }
    })
    .onEnd(() => {
      if (!disabled && !loading) {
        onPress();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgColor = disabled
    ? theme.colors.surfaceSecondary
    : variant === "primary"
    ? theme.colors.primary
    : variant === "secondary"
    ? theme.colors.primaryLight
    : variant === "danger"
    ? theme.colors.danger
    : variant === "outline"
    ? "transparent"
    : "transparent";

  const txtColor = disabled
    ? theme.colors.textTertiary
    : variant === "primary"
    ? theme.colors.textInverse
    : variant === "secondary"
    ? theme.colors.primary
    : variant === "danger"
    ? theme.colors.textInverse
    : variant === "outline"
    ? theme.colors.primary
    : theme.colors.primary;

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: bgColor,
            borderWidth: variant === "outline" ? 1.5 : 0,
            borderColor: disabled ? theme.colors.border : theme.colors.primary,
            opacity: disabled ? 0.6 : 1,
          },
          animatedStyle,
          style,
        ]}
      >
        {loading ? (
          <Text style={[styles.loadingText, { color: txtColor }]}>
            {title}…
          </Text>
        ) : (
          <Text style={[styles.text, { color: txtColor }, textStyle]}>
            {icon ? `${icon}  ` : ""}{title}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
    opacity: 0.8,
  },
});
