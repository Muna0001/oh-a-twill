/** Native: there is no old web app to import from. See legacyImport.web.ts. */
import type { LegacyData } from '@/store';

export type { LegacyData };

export function readLegacy(): LegacyData | null {
  return null;
}
