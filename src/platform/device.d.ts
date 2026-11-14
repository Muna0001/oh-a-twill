/**
 * What `./device` exports. Metro picks `device.web.ts` or `device.native.ts` (Jest, with the
 * jest-expo ios preset, picks the native one); TypeScript has no platform suffixes configured,
 * so it reads this file instead. Both implementations are checked against `DeviceApi`.
 */
import type { DeviceApi } from './types';

export declare const tapHaptic: DeviceApi['tapHaptic'];
export declare const useKeepAwake: DeviceApi['useKeepAwake'];
export declare const useRowKeys: DeviceApi['useRowKeys'];
export declare const confirmAsync: DeviceApi['confirmAsync'];
export declare const scrollIntoView: DeviceApi['scrollIntoView'];
