import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, View } from 'react-native';

import { LIMITS, type PicWeave } from '@/engine';
import { thumbnailSource, type BuiltPicture } from '@/media';
import type { PictureProject } from '@/store';
import { Button, Checkbox, Icon, PaperShape, Segmented, Stepper, Swatch, Text, Tip, useTheme, type SegmentedOption } from '@/ui';

import { pictureCopy as copy } from './copy';
import { useFileDrop } from './useFileDrop';

const THUMB = 96;

const weaveOptions: readonly SegmentedOption<PicWeave>[] = [
  { value: 'twill22', label: copy.weaveTwill },
  { value: 'plain', label: copy.weavePlain },
];

/** The display URI for a stored picture (`imageUri` is opaque), or null until it resolves. */
function useThumbnail(uri: string | null): string | null {
  const [resolved, setResolved] = useState<{ uri: string; src: string } | null>(null);
  useEffect(() => {
    if (!uri) return;
    let stale = false;
    thumbnailSource(uri).then(
      (src) => {
        if (!stale) setResolved({ uri, src });
      },
      () => {},
    );
    return () => {
      stale = true;
    };
  }, [uri]);
  return resolved && resolved.uri === uri ? resolved.src : null;
}

export function UpdatingNote() {
  const theme = useTheme();
  return (
    <View testID="picture-updating" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <ActivityIndicator size="small" color={theme.colors.muted} />
      <Text variant="hint">{copy.updating}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text variant="label" style={{ marginBottom: theme.spacing.xs }}>
      {children}
    </Text>
  );
}

export type PicturePanelProps = {
  project: PictureProject;
  pic: BuiltPicture | null;
  building: boolean;
  /** Message for the warning box, or null. */
  error: string | null;
  picking: boolean;
  onPick: (source: 'library' | 'camera') => void;
  /** Web drag and drop. */
  onDropFile: (file: File) => void;
  onChange: (patch: { weave?: PicWeave; k?: number; rows?: number; tidy?: boolean }) => void;
};

/** The "Picture" panel: the add card, or the thumbnail, palette and settings. */
export function PicturePanel({ project, pic, building, error, picking, onPick, onDropFile, onChange }: PicturePanelProps) {
  const theme = useTheme();
  const has = !!(project.imageUri && pic);
  const thumb = useThumbnail(has ? project.imageUri : null);
  const [attachDrop, over] = useFileDrop(onDropFile);
  const errorBox = error ? (
    <Tip testID="picture-error" style={{ marginTop: theme.spacing.md }}>
      {error}
    </Tip>
  ) : null;

  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, minHeight: theme.minTouch, marginVertical: -10 }}>
      <Text variant="heading">{copy.pictureTitle}</Text>
      {has ? <Button variant="link" label={copy.useAnother} onPress={() => onPick('library')} disabled={picking} style={{ marginRight: -8 }} /> : building ? <UpdatingNote /> : null}
    </View>
  );

  // The first build of a stored picture: show only "Updating…", not the add card.
  if (!has && project.imageUri && building && !error) return head;

  if (!has || !pic) {
    return (
      <>
        {head}
        <View
          ref={attachDrop}
          testID="picture-add"
          style={{
            marginTop: theme.spacing.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: over ? theme.colors.ink : theme.colors.line,
            backgroundColor: over ? theme.colors.cloud : theme.colors.surfaceAlt,
            borderRadius: theme.radii.field,
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.xl,
            paddingHorizontal: theme.spacing.lg,
          }}>
          {/* "No picture yet": the empty state's paper, behind the icon. Never in the row card or preview. */}
          <View style={{ width: 96, height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <PaperShape color="sky" seed={6} width={88} height={64} rotate={-5} dots style={{ top: 4, left: 4 }} />
            <Icon name="arrow-up-tray" size={32} color="pastelInk" strokeWidth={1.5} />
          </View>
          <Text weight="semibold" align="center">
            {copy.addTitle}
          </Text>
          <Text variant="hint" align="center" style={{ maxWidth: 360 }}>
            {copy.addHint}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Button variant="primary" icon="photo" label={copy.choose} onPress={() => onPick('library')} disabled={picking} />
            {Platform.OS !== 'web' ? <Button icon="camera" label={copy.camera} onPress={() => onPick('camera')} disabled={picking} /> : null}
          </View>
        </View>
        {errorBox}
      </>
    );
  }

  const ratio = project.imageW > 0 && project.imageH > 0 ? project.imageW / project.imageH : pic.W / pic.H;
  const showMatch = project.rows !== 0 && project.rows !== pic.autoH;

  return (
    <>
      {head}
      {errorBox}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
        <View style={{ width: THUMB, aspectRatio: ratio, borderRadius: theme.radii.swatch, overflow: 'hidden', backgroundColor: theme.colors.surfaceAlt }}>
          {thumb ? <Image testID="picture-thumb" source={{ uri: thumb }} accessibilityLabel={copy.thumbLabel} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" tabular>
            {copy.size(pic.W, pic.H, pic.palette.length)}
          </Text>
          {building ? (
            <View style={{ marginTop: theme.spacing.xs }}>
              <UpdatingNote />
            </View>
          ) : null}
          <View accessibilityRole="list" accessibilityLabel={copy.paletteLabel} style={{ marginTop: theme.spacing.sm, gap: 6, maxWidth: 320 }}>
            {pic.palette.map((c) => (
              <View key={c.name} accessible accessibilityLabel={`${c.name}, ${copy.squares(c.count)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Swatch color={c.hex} size={18} />
                <Text numberOfLines={1} style={{ flexShrink: 1 }}>
                  {c.name}
                </Text>
                <Text variant="hint" tabular style={{ marginLeft: 'auto' }}>
                  {copy.squares(c.count)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Text variant="hint" style={{ marginTop: theme.spacing.lg }}>
        {copy.how(project.weave)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing.xl, rowGap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
        <View>
          <FieldLabel>{copy.weave}</FieldLabel>
          <Segmented options={weaveOptions} value={project.weave} onChange={(weave) => onChange({ weave })} accessibilityLabel={copy.weave} />
        </View>
        <View>
          <FieldLabel>{copy.colors}</FieldLabel>
          <Stepper
            value={project.k}
            min={LIMITS.colors.min}
            max={LIMITS.colors.max}
            onChange={(k) => onChange({ k })}
            accessibilityLabel={copy.colors}
            decrementLabel={copy.fewerColors}
            incrementLabel={copy.moreColors}
          />
        </View>
        <View>
          <FieldLabel>{copy.rows}</FieldLabel>
          <Stepper
            value={pic.H}
            min={LIMITS.rows.min}
            max={LIMITS.rows.max}
            onChange={(rows) => onChange({ rows })}
            accessibilityLabel={copy.rows}
            decrementLabel={copy.fewerRows}
            incrementLabel={copy.moreRows}
          />
          {showMatch ? <Button variant="link" label={copy.matchShape} onPress={() => onChange({ rows: 0 })} style={{ marginLeft: -8, marginTop: theme.spacing.xs }} /> : null}
        </View>
        <View>
          <FieldLabel>{copy.cleanup}</FieldLabel>
          <Checkbox checked={project.tidy} onChange={(tidy) => onChange({ tidy })} label={copy.tidy} />
        </View>
      </View>
    </>
  );
}
