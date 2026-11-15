import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorToken, type FontWeightName, type TypeVariant } from './theme';

export type TextProps = RNTextProps & {
  /** Default 'body'. `display`, `title` and `subtitle` are serif; the rest are sans. */
  variant?: TypeVariant;
  /** Theme token or any colour string. Defaults to the variant's colour. */
  color?: ColorToken | (string & {});
  /** Overrides the variant's face with a sans weight (so it also turns a serif variant sans). */
  weight?: FontWeightName;
  align?: TextStyle['textAlign'];
  /** Tabular numerals, for numbers that change in place in a fixed slot. Off by default. */
  tabular?: boolean;
};

const tabularStyle: TextStyle = { fontVariant: ['tabular-nums'] };

/** Themed text. `title` and `heading` are announced as headers. Respects the system font scale. */
export function Text({ variant = 'body', color, weight, align, tabular, style, ...rest }: TextProps) {
  const theme = useTheme();
  const spec = theme.type[variant];
  const token = color ?? spec.color;
  const resolved = token in theme.colors ? theme.colors[token as ColorToken] : token;
  const isHeader = variant === 'title' || variant === 'heading';
  return (
    <RNText
      accessibilityRole={isHeader ? 'header' : undefined}
      {...rest}
      style={[
        {
          color: resolved,
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          letterSpacing: spec.letterSpacing,
          textAlign: align,
        },
        theme.fonts[weight ?? spec.face],
        (tabular ?? spec.tabular) ? tabularStyle : null,
        style,
      ]}
    />
  );
}
