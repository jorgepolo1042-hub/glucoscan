import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { getRecentScans } from "../services/scanService";
import { getStreakData } from "../services/streakService";
import type { FoodScan } from "../types/database.types";
import { MAX_FREE_SCANS } from "../services/subscriptionService";
import {
  scheduleDailyReminder,
  cancelAllReminders,
  getReminderStatus,
} from "../services/notificationService";
import { exportDataWithFormat, getExportPreview, DATE_RANGE_LABELS } from "../services/exportService";
import type { DateRange, DateRangePreset } from "../services/exportService";
import {
  getAutoExportSettings,
  saveAutoExportSettings,
} from "../services/autoExportService";
import type { AutoExportFrequency } from "../services/autoExportService";
import { theme } from "../config/theme";
import { ScreenHeader } from "../components/ui/ScreenHeader";

interface ProfileScreenProps {
  onClose: () => void;
  onViewAllScans?: () => void;
  userId: string;
}

export function ProfileScreen({ onClose, onViewAllScans, userId }: ProfileScreenProps) {
  const [userEmail, setUserEmail] = useState<string>("");
  const [totalScans, setTotalScans] = useState(0);
  const [sugarFreeDays, setSugarFreeDays] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<FoodScan[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ preset: "all" });
  const [autoExportEnabled, setAutoExportEnabled] = useState(false);
  const [autoExportEmail, setAutoExportEmail] = useState("");
  const [autoExportFreq, setAutoExportFreq] = useState<AutoExportFrequency>("daily");
  const [autoExportHour, setAutoExportHour] = useState(8);
  const [autoExportLoading, setAutoExportLoading] = useState(false);
  const [autoExportInitialLoading, setAutoExportInitialLoading] = useState(true);
  const [showAutoExportForm, setShowAutoExportForm] = useState(false);
  const [lastAutoExport, setLastAutoExport] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [togglingReminder, setTogglingReminder] = useState(false);
  const [reminderTimeText, setReminderTimeText] = useState("20:00");

  const RECENT_SCANS_COUNT = 10;

  const loadExportPreview = useCallback(async () => {
    try {
      const preview = await getExportPreview(userId, dateRange);
      setExportPreview(preview);
    } catch { setExportPreview(null); }
  }, [userId, dateRange]);

  useEffect(() => { loadProfile(); loadReminderStatus(); loadAutoExportSettings(); }, []);
  useEffect(() => { loadExportPreview(); }, [loadExportPreview]);

  const loadAutoExportSettings = async () => {
    try {
      const settings = await getAutoExportSettings(userId);
      if (settings) {
        setAutoExportEnabled(settings.enabled);
        setAutoExportEmail(settings.email);
        setAutoExportFreq(settings.frequency);
        setAutoExportHour(settings.export_time);
        setLastAutoExport(settings.last_sent_at);
        if (settings.enabled) setShowAutoExportForm(true);
      }
    } catch { /* fine */ } finally { setAutoExportInitialLoading(false); }
  };

  const loadReminderStatus = async () => {
    const status = await getReminderStatus();
    if (status) {
      setReminderEnabled(true);
      setReminderHour(status.hour);
      setReminderMinute(status.minute);
      setReminderTimeText(`${String(status.hour).padStart(2, "0")}:${String(status.minute).padStart(2, "0")}`);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
      const recent = await getRecentScans(RECENT_SCANS_COUNT);
      setTotalScans(recent.length);
      setRecentScans(recent);
      if (userId) {
        const streakData = await getStreakData(userId);
        setCurrentStreak(streakData.currentStreak);
        setSugarFreeDays(streakData.streakHistory.filter((e) => e.is_sugar_free).length);
      }
    } catch (error) { console.error("Failed to load profile:", error); }
    finally { setLoading(false); }
  };

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) { Alert.alert("Error", "Please enter your current password"); return; }
    if (!newPassword || newPassword.length < 6) { Alert.alert("Error", "New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Error", "Passwords do not match"); return; }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Success", "Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update password";
      Alert.alert("Error", msg);
    } finally { setChangingPassword(false); }
  }, [currentPassword, newPassword, confirmPassword]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert("Delete Account", "This will permanently delete your account and all data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setIsDeleting(true);
        try {
          const { error } = await supabase.functions.invoke("delete-user");
          if (error) throw new Error(error.message);
          await supabase.auth.signOut();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Failed to delete account";
          Alert.alert("Error", msg); setIsDeleting(false);
        }
      }},
    ]);
  }, []);

  const handleToggleReminder = useCallback(async () => {
    setTogglingReminder(true);
    try {
      if (reminderEnabled) {
        await cancelAllReminders();
        setReminderEnabled(false);
      } else {
        const id = await scheduleDailyReminder(reminderHour, reminderMinute);
        if (id) setReminderEnabled(true);
        else Alert.alert("Permission Required", "Please enable notifications in your device settings.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update reminder";
      Alert.alert("Error", msg);
    } finally { setTogglingReminder(false); }
  }, [reminderEnabled, reminderHour, reminderMinute]);

  const handleTimeChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9:]/g, "");
    setReminderTimeText(cleaned);
    const match = cleaned.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2] || "0", 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        setReminderHour(h); setReminderMinute(m);
        if (reminderEnabled) scheduleDailyReminder(h, m).catch(console.error);
      }
    }
  }, [reminderEnabled]);

  const handleExport = useCallback(() => {
    Alert.alert("Export Data", "Choose export format:", [
      { text: "📊 PDF (Report with Charts)", onPress: async () => {
        setExporting(true);
        try { await exportDataWithFormat(userId, "pdf", dateRange); }
        catch (error) { const msg = error instanceof Error ? error.message : "Export failed"; Alert.alert("Error", msg); }
        finally { setExporting(false); }
      }},
      { text: "📄 CSV (Spreadsheet)", onPress: async () => {
        setExporting(true);
        try { await exportDataWithFormat(userId, "csv", dateRange); }
        catch (error) { const msg = error instanceof Error ? error.message : "Export failed"; Alert.alert("Error", msg); }
        finally { setExporting(false); }
      }},
      { text: "📝 TXT (Plain Text)", onPress: async () => {
        setExporting(true);
        try { await exportDataWithFormat(userId, "txt", dateRange); }
        catch (error) { const msg = error instanceof Error ? error.message : "Export failed"; Alert.alert("Error", msg); }
        finally { setExporting(false); }
      }},
      { text: "📧 Email (PDF Report)", onPress: async () => {
        setExporting(true);
        try { await exportDataWithFormat(userId, "email", dateRange); }
        catch (error) { const msg = error instanceof Error ? error.message : "Export failed"; Alert.alert("Error", msg); }
        finally { setExporting(false); }
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  }, [userId, dateRange]);

  const handleSaveAutoExport = useCallback(async () => {
    if (!autoExportEmail || !autoExportEmail.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address"); return;
    }
    setAutoExportLoading(true);
    try {
      await saveAutoExportSettings(userId, {
        enabled: autoExportEnabled, frequency: autoExportFreq,
        export_time: autoExportHour, email: autoExportEmail,
      });
      Alert.alert("Auto-Export Saved", autoExportEnabled
        ? `Your ${autoExportFreq} CSV report will be sent to ${autoExportEmail}`
        : "Auto-export has been disabled.");
      if (!autoExportEnabled) setShowAutoExportForm(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to save settings";
      Alert.alert("Error", msg);
    } finally { setAutoExportLoading(false); }
  }, [userId, autoExportEnabled, autoExportEmail, autoExportFreq, autoExportHour]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>      <ScreenHeader title="Settings" icon="⚙️" onClose={onClose} />
        <LoadingSpinner fullScreen color={theme.colors.primary} label="Loading profile..." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Settings" icon="⚙️" onClose={onClose} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userEmail.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{userEmail}</Text>
              <Text style={styles.accountSub}>Free Plan</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalScans}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{sugarFreeDays}</Text>
            <Text style={styles.statLabel}>Sugar-Free Days</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{MAX_FREE_SCANS}</Text>
            <Text style={styles.statLabel}>Daily Scan Limit</Text>
          </View>
        </View>

        {/* Recent Scans */}
        <Text style={styles.sectionLabel}>Recent Scans ({Math.min(totalScans, RECENT_SCANS_COUNT)})</Text>
        {recentScans.length === 0 ? (
          <View style={styles.card}><Text style={styles.emptyScansText}>No scans yet. Start scanning food to see your history!</Text></View>
        ) : (
          <View style={styles.scansList}>
            {recentScans.map((scan) => (
              <View key={scan.id} style={styles.scanCard}>
                <View style={styles.scanCardLeft}>
                  <Text style={styles.scanIcon}>{scan.scan_type === "photo" ? "📸" : scan.scan_type === "barcode" ? "📊" : "✏️"}</Text>
                  <View style={styles.scanInfo}>
                    <Text style={styles.scanName} numberOfLines={1}>{scan.product_name || scan.barcode || "Unknown product"}</Text>
                    <Text style={styles.scanDate}>{new Date(scan.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                </View>
                <View style={styles.scanCardRight}>
                  {scan.is_sugar_free !== null && <Text style={styles.scanSugarBadge}>{scan.is_sugar_free ? "✅" : "🍬"}</Text>}
                  {scan.calories != null && <Text style={styles.scanCalories}>{scan.calories} cal</Text>}
                </View>
              </View>
            ))}
            <Pressable style={({ pressed }) => [styles.viewAllButton, pressed && { opacity: 0.7 }]} onPress={onViewAllScans}>
              <Text style={styles.viewAllText}>📊 View All Scans</Text>
            </Pressable>
          </View>
        )}

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.reminderRow}>
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderTitle}>Daily Check-in Reminder</Text>
              <Text style={styles.reminderSub}>Get a reminder to check your sugar-free status</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.toggleSwitch, reminderEnabled && styles.toggleSwitchActive, togglingReminder && styles.disabled, pressed && !togglingReminder && { opacity: 0.8 }]}
              onPress={handleToggleReminder} disabled={togglingReminder}
            >
              <View style={[styles.toggleKnob, reminderEnabled && styles.toggleKnobActive]} />
            </Pressable>
          </View>
          {reminderEnabled && (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Reminder Time</Text>
              <TextInput style={styles.timeInput} value={reminderTimeText} onChangeText={handleTimeChange} placeholder="20:00" placeholderTextColor={theme.colors.textTertiary} keyboardType="number-pad" maxLength={5} />
              <Text style={styles.timeHint}>HH:MM (24h format)</Text>
            </View>
          )}
        </View>

        {/* Change Password */}
        <Text style={styles.sectionLabel}>Change Password</Text>
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={theme.colors.textTertiary} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry editable={!changingPassword} />
          <TextInput style={styles.input} placeholder="New password (min 6 chars)" placeholderTextColor={theme.colors.textTertiary} value={newPassword} onChangeText={setNewPassword} secureTextEntry editable={!changingPassword} />
          <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={theme.colors.textTertiary} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry editable={!changingPassword} />
          <Pressable style={({ pressed }) => [styles.primaryButton, changingPassword && styles.disabled, pressed && !changingPassword && { opacity: 0.8 }]} onPress={handleChangePassword} disabled={changingPassword}>
            {changingPassword ? <LoadingSpinner size="small" color={theme.colors.textInverse} label="Updating..." /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
          </Pressable>
        </View>

        {/* Export */}
        <Text style={styles.sectionLabel}>Export Data</Text>
        <View style={styles.card}>
          <Text style={styles.timeLabel}>Report Period</Text>
          <View style={styles.rangeRow}>
            {(["7d", "30d", "90d", "all", "custom"] as DateRangePreset[]).map((preset) => {
              const isActive = dateRange.preset === preset;
              return (
                <Pressable key={preset} style={({ pressed }) => [styles.rangeOption, isActive && styles.rangeOptionActive, pressed && { opacity: 0.8 }]} onPress={() => setDateRange({ preset })}>
                  <Text style={[styles.rangeText, isActive && styles.rangeTextActive]}>{DATE_RANGE_LABELS[preset]}</Text>
                </Pressable>
              );
            })}
          </View>
          {dateRange.preset === "custom" && (
            <View style={styles.customDateRow}>
              <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textTertiary} value={dateRange.startDate ?? ""} onChangeText={(text) => setDateRange((prev) => ({ ...prev, startDate: text }))} />
              <Text style={styles.dateSeparator}>→</Text>
              <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textTertiary} value={dateRange.endDate ?? ""} onChangeText={(text) => setDateRange((prev) => ({ ...prev, endDate: text }))} />
            </View>
          )}
          <Pressable style={({ pressed }) => [styles.primaryButton, exporting && styles.disabled, pressed && !exporting && { opacity: 0.8 }]} onPress={handleExport} disabled={exporting}>
            {exporting ? <LoadingSpinner size="small" color={theme.colors.textInverse} label="Exporting..." /> : <Text style={styles.primaryButtonText}>📤 Export Data</Text>}
          </Pressable>
          {exportPreview && <Text style={styles.exportPreviewText}>{exportPreview}</Text>}
        </View>

        {/* Auto-Export */}
        <Text style={styles.sectionLabel}>Scheduled Auto-Export</Text>
        <View style={styles.card}>
          {autoExportInitialLoading ? <LoadingSpinner size="small" color={theme.colors.primary} label="Loading..." /> : (
            <>
              <View style={styles.reminderRow}>
                <View style={styles.reminderInfo}>
                  <Text style={styles.reminderTitle}>Auto-Export CSV</Text>
                  <Text style={styles.reminderSub}>Get your data exported and emailed automatically</Text>
                </View>
                <Pressable style={({ pressed }) => [styles.toggleSwitch, autoExportEnabled && styles.toggleSwitchActive, pressed && { opacity: 0.8 }]} onPress={() => { const n = !autoExportEnabled; setAutoExportEnabled(n); if (n) setShowAutoExportForm(true); else setShowAutoExportForm(false); }}>
                  <View style={[styles.toggleKnob, autoExportEnabled && styles.toggleKnobActive]} />
                </Pressable>
              </View>
              {showAutoExportForm && (
                <View style={styles.autoExportForm}>
                  <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={theme.colors.textTertiary} value={autoExportEmail} onChangeText={setAutoExportEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                  <View style={styles.freqRow}>
                    {(["daily", "weekly"] as AutoExportFrequency[]).map((freq) => {
                      const active = autoExportFreq === freq;
                      return (
                        <Pressable key={freq} style={({ pressed }) => [styles.freqOption, active && styles.freqOptionActive, pressed && { opacity: 0.8 }]} onPress={() => setAutoExportFreq(freq)}>
                          <Text style={[styles.freqText, active && styles.freqTextActive]}>{freq === "daily" ? "Daily" : "Weekly"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Send at (UTC hour)</Text>
                    <View style={styles.hourRow}>
                      <Pressable style={({ pressed }) => [styles.hourArrow, pressed && { opacity: 0.7 }]} onPress={() => setAutoExportHour((h) => Math.max(0, h - 1))}>
                        <Text style={styles.hourArrowText}>−</Text>
                      </Pressable>
                      <Text style={styles.hourValue}>{String(autoExportHour).padStart(2, "0")}:00</Text>
                      <Pressable style={({ pressed }) => [styles.hourArrow, pressed && { opacity: 0.7 }]} onPress={() => setAutoExportHour((h) => Math.min(23, h + 1))}>
                        <Text style={styles.hourArrowText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  {lastAutoExport && <Text style={styles.lastSentText}>Last sent: {new Date(lastAutoExport).toLocaleDateString()}</Text>}
                  <Pressable style={({ pressed }) => [styles.primaryButton, autoExportLoading && styles.disabled, pressed && !autoExportLoading && { opacity: 0.8 }]} onPress={handleSaveAutoExport} disabled={autoExportLoading}>
                    {autoExportLoading ? <LoadingSpinner size="small" color={theme.colors.textInverse} label="Saving..." /> : <Text style={styles.primaryButtonText}>💾 Save Settings</Text>}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionLabel}>Danger Zone</Text>
        <View style={styles.card}>
          <Pressable style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.8 }]} onPress={handleSignOut}>
            <Text style={styles.dangerButtonText}>🚪 Sign Out</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.dangerButtonOutline, isDeleting && styles.disabled, pressed && !isDeleting && { opacity: 0.8 }]} onPress={handleDeleteAccount} disabled={isDeleting}>
            {isDeleting ? <LoadingSpinner size="small" color={theme.colors.danger} label="Deleting..." /> : <Text style={styles.dangerButtonOutlineText}>🗑 Delete Account</Text>}
          </Pressable>
        </View>

        <Text style={styles.versionText}>GlucoScan v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Header provided by ScreenHeader component
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60, gap: 0 },

  sectionLabel: { color: theme.colors.textTertiary, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, ...theme.shadow.sm },

  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center" },
  avatarText: { color: theme.colors.textInverse, fontSize: 22, fontWeight: "800" },
  accountInfo: { flex: 1 },
  accountEmail: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" },
  accountSub: { color: theme.colors.textTertiary, fontSize: 13, marginTop: 2 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { width: "48%", backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, alignItems: "center", ...theme.shadow.sm },
  statNumber: { color: theme.colors.primary, fontSize: 28, fontWeight: "800" },
  statLabel: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 2, textAlign: "center" },

  scansList: { gap: 6 },
  scanCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, ...theme.shadow.sm },
  scanCardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  scanIcon: { fontSize: 20 },
  scanInfo: { flex: 1 },
  scanName: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  scanDate: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 1 },
  scanCardRight: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  scanSugarBadge: { fontSize: 16 },
  scanCalories: { color: theme.colors.textTertiary, fontSize: 12, fontWeight: "600" },
  emptyScansText: { color: theme.colors.textTertiary, fontSize: 14, textAlign: "center", paddingVertical: 8 },
  viewAllButton: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 14, alignItems: "center", marginTop: 2, ...theme.shadow.sm },
  viewAllText: { color: theme.colors.primary, fontSize: 14, fontWeight: "700" },

  reminderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reminderInfo: { flex: 1, marginRight: 16 },
  reminderTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "600" },
  reminderSub: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: theme.colors.border, justifyContent: "center", paddingHorizontal: 3 },
  toggleSwitchActive: { backgroundColor: theme.colors.primary },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.textInverse },
  toggleKnobActive: { alignSelf: "flex-end" },
  timeRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  timeLabel: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  timeInput: { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, textAlign: "center", width: 100, borderWidth: 1, borderColor: theme.colors.border },
  timeHint: { color: theme.colors.textTertiary, fontSize: 11, marginTop: 4 },

  input: { backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryButtonText: { color: theme.colors.textInverse, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },

  dangerButton: { backgroundColor: theme.colors.danger, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  dangerButtonText: { color: theme.colors.textInverse, fontSize: 15, fontWeight: "700" },
  dangerButtonOutline: { borderRadius: theme.radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: theme.colors.danger },
  dangerButtonOutlineText: { color: theme.colors.danger, fontSize: 15, fontWeight: "600" },

  rangeRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  rangeOption: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceSecondary, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  rangeOptionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  rangeText: { color: theme.colors.textTertiary, fontSize: 11, fontWeight: "600" },
  rangeTextActive: { color: theme.colors.textInverse },
  customDateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  dateInput: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, textAlign: "center", borderWidth: 1, borderColor: theme.colors.border },
  dateSeparator: { color: theme.colors.textTertiary, fontSize: 14 },
  exportPreviewText: { color: theme.colors.textTertiary, fontSize: 12, textAlign: "center", marginTop: 10 },

  autoExportForm: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 10 },
  freqRow: { flexDirection: "row", gap: 8 },
  freqOption: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSecondary, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  freqOptionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  freqText: { color: theme.colors.textTertiary, fontSize: 14, fontWeight: "600" },
  freqTextActive: { color: theme.colors.textInverse },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hourArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceSecondary, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  hourArrowText: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  hourValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", minWidth: 60, textAlign: "center" },
  lastSentText: { color: theme.colors.textTertiary, fontSize: 11, textAlign: "center" },
  versionText: { color: theme.colors.textTertiary, fontSize: 12, textAlign: "center", marginTop: 32 },
});
