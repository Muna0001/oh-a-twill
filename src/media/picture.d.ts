/**
 * What `./picture` exports. Metro picks `picture.web.ts` or `picture.native.ts`
 * (Jest, with the jest-expo ios preset, picks the native one); TypeScript has
 * no platform suffixes configured, so it reads this file instead. Both
 * implementations are checked against `MediaApi` where they are defined.
 */
import type { MediaApi } from './types';

export declare const pickPicture: MediaApi['pickPicture'];
export declare const importPictureFile: MediaApi['importPictureFile'];
export declare const importPictureDataUrl: MediaApi['importPictureDataUrl'];
export declare const samplePicture: MediaApi['samplePicture'];
export declare const buildPicture: MediaApi['buildPicture'];
export declare const thumbnailSource: MediaApi['thumbnailSource'];
export declare const deletePicture: MediaApi['deletePicture'];
