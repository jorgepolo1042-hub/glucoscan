export const theme = {
  colors: {
    // Primarios - Azul médico
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
    primaryDark: '#1D4ED8',
    primaryGradient: ['#2563EB', '#1D4ED8'] as const,

    // Semánticos
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',

    // Neutros
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceSecondary: '#F1F5F9',
    border: '#E2E8F0',
    borderFocus: '#2563EB',

    // Texto
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',
    textLink: '#2563EB',

    // Overlay
    overlay: 'rgba(0,0,0,0.4)',
    overlayLight: 'rgba(37,99,235,0.08)',

    // Categorías de glucosa
    glucoseGood: '#10B981',
    glucoseWarning: '#F59E0B',
    glucoseBad: '#EF4444',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },

  typography: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
    hero: 48,

    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export type Theme = typeof theme;
