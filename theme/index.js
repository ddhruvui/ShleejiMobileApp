/**
 * Shleeji design tokens — the single source for colour, type, spacing, shape
 * and elevation. Screens and components import from here instead of writing
 * hex values or font sizes inline, so the whole app reads as one system.
 *
 * Direction ("calm focus"): a quiet off-white canvas, white cards, one indigo
 * brand colour for everything interactive, and a warm saffron accent reserved
 * for practice/progress moments (the mada counter's beads, habit streaks).
 * Semantic tones (success / danger / warning / info) each come as a strong
 * colour, a soft background and an accessible text colour.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const colors = {
  // Brand — merges the old blue (#1e88e5) and purple (#6200ee) into one hue.
  primary: "#4F46E5",
  primaryPressed: "#4338CA",
  primarySoft: "#EEF0FE",
  primaryBorder: "#C9CCF8",
  primaryText: "#4338CA",
  onPrimary: "#FFFFFF",

  // Warm accent — practice, streaks, progress.
  accent: "#E8890C",
  accentSoft: "#FFF3E0",
  accentBorder: "#F6CF98",
  accentText: "#9A4D00",

  success: "#16A34A",
  successSoft: "#E9F7EE",
  successBorder: "#BFE5CC",
  successText: "#15803D",

  danger: "#DC2626",
  dangerSoft: "#FDEEEE",
  dangerBorder: "#F7CACA",
  dangerText: "#B91C1C",
  dangerOnDark: "#FF6B6B",

  warning: "#D97706",
  warningSoft: "#FEF5E7",
  warningBorder: "#F5D9A8",
  warningText: "#92400E",

  info: "#0284C7",
  infoSoft: "#E8F4FB",
  infoBorder: "#BBDDF2",
  infoText: "#075985",

  // Neutrals
  bg: "#F5F6FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F2F7",
  surfaceSunken: "#E9EBF2",
  border: "#E4E6EE",
  borderStrong: "#CDD1DC",
  divider: "#EEF0F5",

  text: "#151823",
  textSecondary: "#5B6172",
  textTertiary: "#8C92A3",
  textDisabled: "#B4B9C6",
  textInverse: "#FFFFFF",

  overlay: "rgba(15, 18, 30, 0.45)",
  scrim: "rgba(6, 8, 14, 0.97)",
  white: "#FFFFFF",
  black: "#000000",
};

/** Soft tints cycled by lists that want a little warmth (affirmations, avatars). */
export const tints = [
  { bg: colors.primarySoft, fg: colors.primaryText, border: colors.primaryBorder },
  { bg: colors.accentSoft, fg: colors.accentText, border: colors.accentBorder },
  { bg: colors.successSoft, fg: colors.successText, border: colors.successBorder },
  { bg: colors.infoSoft, fg: colors.infoText, border: colors.infoBorder },
];

/** Stable tint for a string (e.g. a person's name) so it never reshuffles. */
export function tintFor(key = "") {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return tints[Math.abs(hash) % tints.length];
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

/** Type ramp (system font: SF Pro on iOS, Roboto on Android). */
export const type = {
  largeTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.text,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.text,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.text,
  },
  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.text,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
};

export const shadows = {
  card: {
    shadowColor: "#1B2240",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: "#1B2240",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  floating: {
    shadowColor: "#1B2240",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
};

/** Minimum touch target (Apple HIG 44pt / Material 48dp). */
export const HIT_TARGET = 44;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/** Floating tab bar geometry — App.js draws it, screens clear it. */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_SIDE_GAP = 12;

/** Distance from the screen's bottom edge to the floating tab bar. */
export function tabBarBottomOffset(bottomInset) {
  return Math.max(bottomInset - 8, 12);
}

/**
 * Bottom padding a scrolling screen needs so its last row clears the floating
 * tab bar (which overlaps content) plus a little breathing room.
 */
export function useBottomClearance(extra = spacing.lg) {
  const insets = useSafeAreaInsets();
  return tabBarBottomOffset(insets.bottom) + TAB_BAR_HEIGHT + extra;
}

const theme = { colors, tints, spacing, radii, type, shadows };
export default theme;
