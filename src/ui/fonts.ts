// Per-weight entry points: the package index would pull every weight and italic into the build.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Platform } from 'react-native';

/** Inter family names registered with expo-font: one per weight. */
export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Lora 400: headings of 24 px and up only. */
export const serifFamily = 'Lora_400Regular';

/** System serif, used if the bundled fonts fail to load. */
export const systemSerif: string =
  Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, "Times New Roman", serif' }) ?? 'serif';

/** Map handed to `useFonts`. The TTFs are bundled, so nothing is fetched from a font host. */
export const fontMap = {
  [fontFamilies.regular]: Inter_400Regular,
  [fontFamilies.medium]: Inter_500Medium,
  [fontFamilies.semibold]: Inter_600SemiBold,
  [fontFamilies.bold]: Inter_700Bold,
  [serifFamily]: Lora_400Regular,
};
