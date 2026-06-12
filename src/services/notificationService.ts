import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications behave while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DEFAULT_HOUR = 20; // 8:00 PM
const DEFAULT_MINUTE = 0;

/**
 * Request notification permissions from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return false;
  }

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminder", {
      name: "Daily Check-in Reminder",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4CAF50",
    });
  }

  return true;
}

/**
 * Schedule a daily recurring notification at the specified time.
 * Returns the notification identifier string.
 */
export async function scheduleDailyReminder(
  hour: number = DEFAULT_HOUR,
  minute: number = DEFAULT_MINUTE
): Promise<string | null> {
  // Cancel any existing scheduled reminders first
  await cancelAllReminders();

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "🧃 GlucoScan Daily Check-in",
      body: "Did you stay sugar-free today? Tap to check in!",
      sound: true,
      data: { screen: "streaks" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return identifier;
}

/**
 * Cancel all scheduled daily reminders.
 */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the currently scheduled notifications.
 */
export async function getScheduledReminders(): Promise<
  Notifications.NotificationRequest[]
> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  // Filter to only our daily reminders
  return scheduled.filter((n) => {
    const trigger = n.trigger;
    return (
      trigger &&
      typeof trigger === "object" &&
      "type" in trigger &&
      trigger.type === "daily"
    );
  });
}

/**
 * Check if a daily reminder is currently scheduled.
 * Returns null if none, or the trigger details if one exists.
 */
export async function getReminderStatus(): Promise<{
  isScheduled: boolean;
  hour: number;
  minute: number;
} | null> {
  const reminders = await getScheduledReminders();
  if (reminders.length === 0) return null;

  const trigger = reminders[0].trigger as
    | { hour: number; minute: number }
    | undefined;

  return {
    isScheduled: true,
    hour: trigger?.hour ?? DEFAULT_HOUR,
    minute: trigger?.minute ?? DEFAULT_MINUTE,
  };
}
