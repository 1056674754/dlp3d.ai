/**
 * Android/iOS system font scale (accessibility → larger text) multiplies RN Text sizes.
 * Without a cap, Material + navigation can feel like "large / elderly" mode on phones
 * that use default or boosted display scaling.
 */
import { Text, TextInput } from 'react-native';

/**
 * Keep the app at design size by default.
 * Some Android large-screen devices ship with boosted system text scaling,
 * which makes the UI look oversized even in non-accessibility use.
 */
export const MAX_FONT_SIZE_MULTIPLIER = 1.0;

export const paperButtonFontScalingProps = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

export const paperChipFontScalingProps = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

export const paperFabFontScalingProps = {
  labelMaxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

export const paperListItemFontScalingProps = {
  titleMaxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
  descriptionMaxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

export const paperSubheaderFontScalingProps = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

export const paperTextInputFontScalingProps = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
} as const;

const T = Text as typeof Text & {
  defaultProps?: { maxFontSizeMultiplier?: number };
};
const TI = TextInput as typeof TextInput & {
  defaultProps?: { maxFontSizeMultiplier?: number };
};

T.defaultProps = {
  ...T.defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
};
TI.defaultProps = {
  ...TI.defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
};
