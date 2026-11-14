import type { PictureGrid } from '@/engine/types';

export type PickSource = 'library' | 'camera';

/**
 * A picture that has been imported and stored on this device.
 * `uri` is opaque: pass it back to this module (`thumbnailSource` turns it
 * into something `<Image>` can show). `width`/`height` are the stored size.
 */
export interface PickedPicture {
  uri: string;
  width: number;
  height: number;
}

/** The fields of a PictureProject that decide the grid. */
export interface BuildPictureParams {
  imageUri: string;
  imageW: number;
  imageH: number;
  warps: number;
  /** 0 = match the picture's shape. */
  rows: number;
  k: number;
  tidy: boolean;
}

/** `autoH` is the row count that matches the picture's shape at this warp count. */
export type BuiltPicture = PictureGrid & { autoH: number };

/** The platform half of the module. `picture.web.ts` and `picture.native.ts` both implement it. */
export interface MediaApi {
  /** Opens the system picker. Resolves null when the user cancels. */
  pickPicture(source: PickSource): Promise<PickedPicture | null>;
  /** Web only (drag and drop, tests). Rejects on native. */
  importPictureFile(file: Blob): Promise<PickedPicture>;
  /** Imports a `data:image/...;base64,` URL, e.g. the old web app's saved picture. */
  importPictureDataUrl(dataUrl: string): Promise<PickedPicture>;
  /** W * H averaged pixels as r, g, b triples (the engine's `boxAverage` output). */
  samplePicture(uri: string, W: number, H: number): Promise<Float32Array>;
  buildPicture(p: BuildPictureParams): Promise<BuiltPicture>;
  /** A URI that `<Image source={{ uri }}>` can display. */
  thumbnailSource(uri: string): Promise<string>;
  deletePicture(uri: string): Promise<void>;
}
