import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { theme } from "../config/theme";
import { AnimatedButton } from "../components/ui/AnimatedButton";

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({
  scheme: "glucoscan",
  path: "/auth/callback",
});

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return false;
    }
    if (!password || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleEmailAuth = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user) onAuthSuccess(data.user.id);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (data.user?.identities?.length === 0) {
          Alert.alert(
            "Account exists",
            "This email is already registered. Please log in instead."
          );
        } else if (data.user) {
          Alert.alert(
            "Check your email",
            "We've sent you a confirmation link. Please verify your email before logging in."
          );
          setIsLogin(true);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        );

        if (result.type === "success") {
          // After successful redirect, Supabase automatically
          // handles the session. Just get the current user.
          const { data: { user }, error: userError } =
            await supabase.auth.getUser();

          if (userError) throw userError;
          if (user) {
            onAuthSuccess(user.id);
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `${provider} login failed`;
      Alert.alert("Error", message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email first");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim()
      );
      if (error) throw error;
      Alert.alert(
        "Password reset email sent",
        "Check your inbox for the reset link."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send reset email";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>🩺</Text>
          </View>
          <Text style={styles.appName}>GlucoScan</Text>
          <Text style={styles.tagline}>
            Scan food. Track sugar. Stay healthy.
          </Text>
        </View>

        {/* Auth Card */}
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </Text>
          <Text style={styles.authSubtitle}>
            {isLogin
              ? "Sign in to continue your journey"
              : "Start your sugar-free journey"}
          </Text>

          {/* ── Email/Password Form ── */}
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={theme.colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor={theme.colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {isLogin && (
            <Pressable
              style={({ pressed }) => [styles.forgotButton, pressed && { opacity: 0.7 }]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          <AnimatedButton
            title={isLogin ? "Sign In" : "Create Account"}
            onPress={handleEmailAuth}
            disabled={loading}
            loading={loading}
            style={{ marginTop: 16 }}
          />

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social Buttons ── */}
          <View style={styles.socialRow}>
            <AnimatedButton
              title="Google"
              icon="G"
              onPress={() => handleOAuthLogin("google")}
              variant="outline"
              disabled={socialLoading !== null}
              loading={socialLoading === "google"}
              style={{ flex: 1 }}
            />
            {Platform.OS === "ios" && (
              <AnimatedButton
                title="Apple"
                icon="🍎"
                onPress={() => handleOAuthLogin("apple")}
                variant="outline"
                disabled={socialLoading !== null}
                loading={socialLoading === "apple"}
                style={{ flex: 1 }}
              />
            )}
          </View>

          {/* ── Toggle auth mode ── */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <Pressable
              onPress={() => {
                setIsLogin(!isLogin);
                setPassword("");
              }}
              disabled={loading}
            >
              <Text style={styles.switchLink}>
                {isLogin ? "Sign Up" : "Sign In"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 60,
  },

  // Brand
  brandSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: "800",
  },
  tagline: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
  },

  // Auth Card
  authCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  authTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  authSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },

  // Inputs
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    color: theme.colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Forgot
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    marginBottom: 4,
  },
  forgotText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textTertiary,
    fontSize: 13,
    marginHorizontal: 12,
  },

  socialRow: {
    flexDirection: "row",
    gap: 10,
  },

  // Toggle
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
  switchText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  switchLink: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
