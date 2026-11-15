import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold,
} from '@expo-google-fonts/familjen-grotesk';
import { Platform } from 'react-native';

/*
 * Spec (docs/design.md): Inter 400/500/600/700 for everything, Lora 400 for headings of 24 px and up.
 * The Lora and Inter packages are not installed yet, so the sans faces are still the bundled
 * Familjen Grotesk and the serif is the system serif. Swapping in the packages only touches this file:
 * import Inter_400Regular … Inter_700Bold and Lora_400Regular, point `fontFamilies` at them, set
 * `serifFamily` to 'Lora_400Regular' and add it to `fontMap`.
 */

/** Family names registered with expo-font: one per weight. */
export const fontFamilies = {
  regular: 'FamiljenGrotesk_400Regular',
  medium: 'FamiljenGrotesk_500Medium',
  semibold: 'FamiljenGrotesk_600SemiBold',
  bold: 'FamiljenGrotesk_700Bold',
} as const;

/** System serif used before (or instead of) the bundled one. */
export const systemSerif: string =
  Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, "Times New Roman", serif' }) ?? 'serif';

/** The serif family once fonts are loaded. Null while no serif is bundled: the system serif is used. */
export const serifFamily: string | null = null;

/** Map handed to `useFonts`. The TTFs are bundled, so nothing is fetched from a font host. */
export const fontMap = {
  [fontFamilies.regular]: FamiljenGrotesk_400Regular,
  [fontFamilies.medium]: FamiljenGrotesk_500Medium,
  [fontFamilies.semibold]: FamiljenGrotesk_600SemiBold,
  [fontFamilies.bold]: FamiljenGrotesk_700Bold,
};
