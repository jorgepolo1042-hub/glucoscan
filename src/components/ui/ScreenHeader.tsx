import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';

interface ScreenHeaderProps {
  title: string;
  icon?: string;
  onClose?: () => void;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({
  title,
  icon,
  onClose,
  onBack,
  rightAction,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
            onPress={onBack}
            hitSlop={8}
          >
            <Text style={styles.navButtonText}>←</Text>
          </Pressable>
        ) : onClose ? (
          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.7 }]}
            onPress={onClose}
            hitSlop={8}
          >
            <Text style={styles.navButtonText}>✕</Text>
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {icon ? `${icon} ` : ''}{title}
        </Text>
      </View>

      <View style={styles.right}>
        {rightAction ?? <View style={styles.navButtonPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  navButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
