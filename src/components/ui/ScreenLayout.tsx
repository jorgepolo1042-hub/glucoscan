import React from 'react';
import { View, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../config/theme';

interface ScreenLayoutProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  statusBarStyle?: 'dark-content' | 'light-content';
  backgroundColor?: string;
}

export function ScreenLayout({
  children,
  scrollable = true,
  padded = true,
  statusBarStyle = 'dark-content',
  backgroundColor = theme.colors.background,
}: ScreenLayoutProps) {
  const content = (
    <View style={[styles.inner, padded && styles.padded]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  inner: { flex: 1 },
  padded: { paddingHorizontal: theme.spacing.base },
});
