import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  Animated,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../config/theme';
import { AnimatedButton } from '../components/ui/AnimatedButton';
import {
  getSubscriptionStatus,
  purchasePackage,
  restorePurchases,
} from '../services/subscriptionService';
import type { PurchasesOffering } from 'react-native-purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Slides data ──

interface FeatureSlide {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
}

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    icon: '🍽️',
    title: 'Smart Food Scanner',
    subtitle: 'Barcode & AI Photo Recognition',
    description:
      'Scan any food barcode or snap a photo. Our AI instantly analyzes nutritional content, sugar levels, and more — no manual entry needed.',
  },
  {
    icon: '📊',
    title: 'Real-Time Nutrition Facts',
    subtitle: 'Know What You Eat',
    description:
      'Get detailed nutritional breakdowns: calories, sugar, carbs, protein, and fat. See at a glance if a product is sugar-free and diabetes-friendly.',
  },
  {
    icon: '🔥',
    title: 'Sugar-Free Streaks',
    subtitle: 'Build Healthy Habits',
    description:
      'Track your daily sugar intake and maintain your streak. Stay motivated with milestones, achievements, and personalized progress insights.',
  },
  {
    icon: '📋',
    title: 'AI Meal Plans',
    subtitle: 'Personalized Just for You',
    description:
      'Generate custom meal plans tailored to your dietary needs, preferences, and blood sugar goals. Low-carb, keto, Mediterranean — you choose.',
  },
  {
    icon: '🤖',
    title: 'Clinical Assistant',
    subtitle: 'AI-Powered Medical Insights',
    description:
      'Upload lab results or medical PDFs and ask questions. Our AI analyzes your documents to provide clear, actionable clinical information.',
  },
];

// ── Pricing plans ──

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: '$0',
    period: '',
    description: 'Get started with 5 free scans',
    features: ['5 food scans', 'Barcode scanning', 'Basic nutrition info'],
    badge: 'Try it free',
  },
  {
    id: 'weekly',
    name: 'Weekly',
    price: '$3.99',
    period: '/week',
    description: 'Full access, cancel anytime',
    features: [
      'Unlimited scans',
      'AI photo analysis',
      'Meal plans',
      'Streak tracking',
      'Clinical assistant',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$7.99',
    period: '/month',
    description: 'Best value for regular users',
    features: [
      'Everything in Weekly',
      'Priority support',
      'Advanced analytics',
      'Data export (PDF/CSV)',
    ],
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$39.99',
    period: ' one-time',
    description: 'Pay once, own forever',
    features: [
      'Everything in Monthly',
      'All future features',
      'Premium badge',
      'Early access',
    ],
    badge: 'Best Value',
  },
];

// ── Dot indicator ──

function PaginationDots({
  count,
  currentIndex,
}: {
  count: number;
  currentIndex: number;
}) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === currentIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

// ── Onboarding Screen ──

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const totalSlides = FEATURE_SLIDES.length + 1; // features + pricing

  // Fetch RevenueCat offerings
  useEffect(() => {
    getSubscriptionStatus().then((status) => {
      setOfferings(status.offering);
    });
  }, []);

  const handlePurchase = useCallback(async (planId: string) => {
    if (!offerings) return;
    // Trial doesn't need purchase
    if (planId === 'trial') {
      onComplete();
      return;
    }
    setPurchasing(planId);
    try {
      const pkg =
        planId === 'weekly'
          ? offerings.weekly
          : planId === 'monthly'
          ? offerings.monthly
          : planId === 'lifetime'
          ? offerings.lifetime
          : null;
      if (!pkg) {
        Alert.alert('Not available', 'This plan is not currently available.');
        return;
      }
      const success = await purchasePackage(pkg);
      if (success) {
        onComplete();
      }
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.message || 'Something went wrong.');
    } finally {
      setPurchasing(null);
    }
  }, [offerings, onComplete]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    const success = await restorePurchases();
    setRestoring(false);
    if (success) {
      onComplete();
    } else {
      Alert.alert('No purchases found', 'No previous purchases were found to restore.');
    }
  }, [onComplete]);

  const totalPages = totalSlides;

  const isLastSlide = currentIndex === totalSlides - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onComplete();
      return;
    }
    const nextIndex = currentIndex + 1;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  }, [currentIndex, isLastSlide, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(index);
    },
    []
  );

  // ── Render feature slide ──

  const renderFeatureSlide = ({ item, index }: { item: FeatureSlide; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const iconScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
      extrapolate: 'clamp',
    });

    const titleOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.slide}>
        <Animated.View
          style={[styles.iconWrapper, { transform: [{ scale: iconScale }] }]}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity }}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  // ── Render pricing slide ──

  const renderPricingSlide = () => (
    <View style={styles.pricingSlide}>
      <Text style={styles.pricingTitle}>Choose Your Plan</Text>
      <Text style={styles.pricingSubtitle}>
        Start with 5 free scans, then upgrade anytime
      </Text>

      <View style={styles.plansContainer}>
        {PRICING_PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              plan.highlighted && styles.planCardHighlighted,
            ]}
          >
            {plan.badge && (
              <View
                style={[
                  styles.planBadge,
                  plan.highlighted && styles.planBadgeHighlighted,
                ]}
              >
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{plan.price}</Text>
              {plan.period ? (
                <Text style={styles.planPeriod}>{plan.period}</Text>
              ) : null}
            </View>
            <Text style={styles.planDescription}>{plan.description}</Text>
            <View style={styles.planFeatures}>
              {plan.features.map((feat, i) => (
                <View key={i} style={styles.planFeatureRow}>
                  <Text style={styles.planFeatureCheck}>✓</Text>
                  <Text style={styles.planFeatureText}>{feat}</Text>
                </View>
              ))}
            </View>
            <AnimatedButton
              title={
                plan.id === 'trial'
                  ? 'Start Free'
                  : plan.id === 'lifetime'
                  ? 'Get Lifetime'
                  : 'Subscribe'
              }
              onPress={() => handlePurchase(plan.id)}
              variant={plan.highlighted ? 'primary' : 'outline'}
              disabled={purchasing === plan.id || (plan.id !== 'trial' && !offerings)}
              loading={purchasing === plan.id}
              style={styles.planCta}
            />
          </View>
        ))}
      </View>
    </View>
  );

  // ── Data for FlatList ──

  const data = [
    ...FEATURE_SLIDES.map((slide, index) => ({
      type: 'feature' as const,
      ...slide,
      index,
    })),
    { type: 'pricing' as const, index: FEATURE_SLIDES.length },
  ];

  const renderItem = ({
    item,
  }: {
    item:
      | (FeatureSlide & { type: 'feature'; index: number })
      | { type: 'pricing'; index: number };
  }) => {
    if (item.type === 'feature') {
      return renderFeatureSlide({
        item: item as FeatureSlide,
        index: item.index,
      });
    }
    return renderPricingSlide();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Skip button */}
      {!isLastSlide && (
        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.7 }]}
          onPress={handleSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        keyExtractor={(item) =>
          item.type === 'pricing' ? 'pricing' : `feature-${item.index}`
        }
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        <PaginationDots count={totalPages} currentIndex={currentIndex} />

        {isLastSlide && (
          <Pressable
            style={({ pressed }) => [styles.restoreButton, pressed && { opacity: 0.7 }]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </Pressable>
        )}
        <AnimatedButton
          title={isLastSlide ? 'Get Started' : 'Continue'}
          onPress={handleNext}
          variant="primary"
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Skip
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 8 : 16,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Slide common
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Icon
  iconWrapper: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 52,
  },

  // Text
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  slideSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },

  // ── Pricing ──
  pricingSlide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 8,
  },
  pricingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  pricingSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  plansContainer: {
    gap: 10,
  },
  planCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  planCardHighlighted: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    ...theme.shadow.md,
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  planBadgeHighlighted: {
    backgroundColor: theme.colors.primary,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  planPeriod: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginLeft: 2,
  },
  planDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  planFeatures: {
    gap: 4,
    marginBottom: 12,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planFeatureCheck: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: '700',
  },
  planFeatureText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  planCta: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  planCtaHighlighted: {
    backgroundColor: theme.colors.primary,
  },
  planCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  planCtaTextHighlighted: {
    color: '#FFFFFF',
  },

  // ── Bottom ──
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: theme.colors.border,
  },
  continueButton: {
    width: '100%',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreButton: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  restoreText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
