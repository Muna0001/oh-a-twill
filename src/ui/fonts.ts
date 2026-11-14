import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold,
} from '@expo-google-fonts/familjen-grotesk';

/** Family names registered with expo-font: one per weight. */
export const fontFamilies = {
  regular: 'FamiljenGrotesk_400Regular',
  medium: 'FamiljenGrotesk_500Medium',
  semibold: 'FamiljenGrotesk_600SemiBold',
  bold: 'FamiljenGrotesk_700Bold',
} as const;

/** Map handed to `useFonts`. The TTFs are bundled, so nothing is fetched from a font host. */
export const fontMap = {
  [fontFamilies.regular]: FamiljenGrotesk_400Regular,
  [fontFamilies.medium]: FamiljenGrotesk_500Medium,
  [fontFamilies.semibold]: FamiljenGrotesk_600SemiBold,
  [fontFamilies.bold]: FamiljenGrotesk_700Bold,
};
