/**
 * Android/iOS system font scale (accessibility → larger text) multiplies RN Text sizes.
 * Without a cap, Material + navigation can feel like "large / elderly" mode on phones
 * that use default or boosted display scaling.
 */
import { Text, TextInput } from 'react-native';

/** Still allows ~15% scaling for mild accessibility; set lower (e.g. 1.0) for stricter cap. */
const MAX_FONT_SIZE_MULTIPLIER = 1.15;

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
