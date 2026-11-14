import { useMemo } from 'react';
import { View } from 'react-native';

import { picRowInfo, type PicWeave } from '@/engine';
import type { BuiltPicture } from '@/media';
import { Button, Chip, Panel, Text, useTheme } from '@/ui';
import { PictureStrip, SectionChips, StripScroller, WarpNumbers } from '@/weave';

import { pictureCopy as copy } from './copy';

export type RowCardProps = {
  pic: BuiltPicture;
  weave: PicWeave;
  /** 1-based; `pic.H + 1` means finished. */
  row: number;
  onRestart: () => void;
};

/** The hero card for the row being woven, or the "Finished" card after the last row. */
export function RowCard({ pic, weave, row, onRestart }: RowCardProps) {
  const theme = useTheme();
  const finished = row > pic.H;
  const info = useMemo(() => (finished ? null : picRowInfo(pic, weave, Math.max(1, row))), [pic, weave, row, finished]);
  const hexes = useMemo(() => pic.palette.map((c) => c.hex), [pic.palette]);

  const restart = <Button icon="arrow-path" label={copy.restart} onPress={onRestart} style={{ marginTop: theme.spacing.lg }} />;

  if (!info) {
    return (
      <Panel variant="hero" testID="picture-row-card" accessibilityLabel={copy.finished}>
        <View accessibilityLiveRegion="polite">
          <Text variant="rowNumber">{copy.finished}</Text>
          <Text color="muted" style={{ marginTop: theme.spacing.xs }}>
            {copy.finishedSub(pic.H)}
          </Text>
        </View>
        {restart}
      </Panel>
    );
  }

  const n = info.sections.length;
  return (
    <Panel variant="hero" testID="picture-row-card">
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <View accessible accessibilityRole="header" accessibilityLabel={`${copy.row(info.row)} ${copy.of(pic.H)}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="rowNumber">{copy.row(info.row)}</Text>
          <Text variant="hint" weight="medium" tabular style={{ fontSize: 16 }}>
            {copy.of(pic.H)}
          </Text>
        </View>
        <Chip tone="over" label={copy.sections(n)} testID="picture-section-count" />
      </View>
      <Text color="muted" testID="picture-row-sub" style={{ marginTop: theme.spacing.xs }}>
        {info.sameAsPrevious ? copy.same : copy.weaveEach}
      </Text>
      <StripScroller count={pic.W} style={{ marginTop: theme.spacing.lg }}>
        <PictureStrip cells={info.cells} over={info.over} palette={hexes} />
        <WarpNumbers count={pic.W} />
      </StripScroller>
      <SectionChips sections={info.sections} palette={pic.palette} row={info.row} testID="picture-sections" style={{ marginTop: theme.spacing.lg }} />
      {info.row > 1 ? restart : null}
    </Panel>
  );
}
