import { createContext } from 'react';

/** True inside a BottomBar on a window narrower than 360 pt: `lg` buttons tighten up to keep the bar on one line. */
export const CompactBarContext = createContext(false);
