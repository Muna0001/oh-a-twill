import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { CATEGORIES, getStitch, listStitches } from '@/catalog';
import type { StitchCategory } from '@/engine';
import { importPictureDataUrl } from '@/media';
import { readLegacy, type LegacyData } from '@/platform/legacyImport';
import { useProject, useProjects, useSettings, type Project } from '@/store';
import { Button, Chip, EmptyState, Panel, Screen, SearchField, Text, useTheme } from '@/ui';
import { TilePreview } from '@/weave';

import { libraryCopy as copy } from './copy';
import { StitchCard } from './parts';

type Filter = 'all' | StitchCategory | 'favorites';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: copy.all },
  ...CATEGORIES.map((c) => ({ id: c.id as Filter, label: c.label })),
  { id: 'favorites', label: copy.favorites },
];

const GAP = 12;
const MAX_CARD = 200;

/** How many columns fit: at least 2, and cards no wider than about 200. */
function columnsFor(contentWidth: number): number {
  return Math.max(2, Math.ceil((contentWidth + GAP) / (MAX_CARD + GAP)));
}

export function LibraryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const favourites = useSettings((s) => s.favourites);
  const colors = useSettings((s) => s.defaultColors);
  const [legacy] = useState(readLegacy);
  const legacyHandled = useSettings((s) => s.legacyImportHandled);
  const offerLegacy = !!legacy && !legacyHandled;

  const stitches = useMemo(
    () =>
      listStitches({
        category: filter === 'all' || filter === 'favorites' ? 'all' : filter,
        favourites: filter === 'favorites' ? favourites : undefined,
        query,
      }),
    [filter, favourites, query],
  );

  const contentWidth = Math.min(width, theme.maxContentWidth) - theme.spacing.lg * 2;
  const cols = columnsFor(contentWidth);
  const cardWidth = Math.floor((contentWidth - GAP * (cols - 1)) / cols);

  const searching = query.trim() !== '';
  const empty =
    filter === 'favorites' && !searching
      ? { title: copy.noFavoritesTitle, message: copy.noFavoritesMessage }
      : { title: copy.noMatchTitle, message: searching ? copy.noMatchMessage(query.trim()) : copy.noMatchInCategory };

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
        {copy.title}
      </Text>

      {legacy && offerLegacy ? <LegacyOffer legacy={legacy} /> : null}
      <TopCard quickStart={!offerLegacy} />

      <SearchField value={query} onChangeText={setQuery} placeholder={copy.searchPlaceholder} accessibilityLabel={copy.searchLabel} testID="library-search" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={copy.categoriesLabel}
        style={{ marginTop: theme.spacing.md, marginHorizontal: -theme.spacing.lg, flexGrow: 0 }}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            tone="outline"
            selected={filter === f.id}
            icon={f.id === 'favorites' ? 'heart' : undefined}
            onPress={() => setFilter(f.id)}
            testID={`filter-${f.id}`}
          />
        ))}
      </ScrollView>

      {stitches.length === 0 ? (
        <EmptyState
          testID="library-empty"
          icon={filter === 'favorites' && !searching ? 'heart' : 'magnifying-glass'}
          title={empty.title}
          message={empty.message}
          action={
            filter !== 'all' || searching ? (
              <Button
                label={copy.showAll}
                onPress={() => {
                  setFilter('all');
                  setQuery('');
                }}
              />
            ) : null
          }
        />
      ) : (
        <View testID="stitch-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: theme.spacing.lg }}>
          {stitches.map((s) => (
            <StitchCard
              key={s.id}
              stitch={s}
              colors={colors}
              favourite={favourites.includes(s.id)}
              onPress={() => router.push(`/stitch/${s.id}`)}
              style={{ width: cardWidth }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * Continue (the last opened project), Quick start (no projects yet), or nothing. Quick start
 * waits while the old helper's weaving is on offer, so first launch asks one thing at a time.
 */
function TopCard({ quickStart }: { quickStart: boolean }) {
  const lastOpenedId = useProjects((s) => s.lastOpenedId);
  const hasProjects = useProjects((s) => s.order.length > 0);
  const last = useProject(lastOpenedId);
  if (last) return <ContinueCard project={last} />;
  if (!hasProjects && quickStart) return <QuickStartCard />;
  return null;
}

function ContinueCard({ project }: { project: Project }) {
  const theme = useTheme();
  const stitch = project.kind === 'pattern' ? getStitch(project.stitchId) : undefined;
  const meta = project.kind === 'pattern' ? copy.rowAndWarps(project.row, project.warps) : copy.pictureRowAndWarps(project.row, project.warps);
  return (
    <Panel testID="continue-card" variant="hero">
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        {stitch && project.kind === 'pattern' ? (
          <View style={{ width: 84 }}>
            <TilePreview stitch={stitch} colors={project.colors} cols={12} rows={10} mirror={project.setup.mirror} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{copy.continueLabel}</Text>
          <Text variant="heading" numberOfLines={2}>
            {project.name}
          </Text>
          <Text color="muted" tabular>
            {meta}
          </Text>
        </View>
      </View>
      <Button
        variant="primary"
        label={copy.continueButton}
        accessibilityLabel={copy.continueA11y(project.name)}
        trailingIcon="chevron-right"
        fullWidth
        style={{ marginTop: theme.spacing.md }}
        onPress={() => router.push(`/project/${project.id}`)}
      />
    </Panel>
  );
}

function QuickStartCard() {
  const theme = useTheme();
  const warps = useSettings((s) => s.defaultWarps);
  const colors = useSettings((s) => s.defaultColors);
  const twill = getStitch('twill22');
  const start = () => {
    const { createPattern, open } = useProjects.getState();
    const settings = useSettings.getState();
    const id = createPattern({
      stitchId: 'twill22',
      name: copy.quickStartName,
      warps: settings.defaultWarps,
      colors: settings.defaultColors,
      setup: { side: settings.defaultSide },
    });
    open(id);
    router.push(`/project/${id}`);
  };
  return (
    <Panel testID="quick-start-card" variant="hero">
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        {twill ? (
          <View style={{ width: 84 }}>
            <TilePreview stitch={twill} colors={colors} cols={12} rows={10} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{copy.quickStartLabel}</Text>
          <Text variant="heading">{copy.quickStartLine(warps)}</Text>
          <Text variant="hint">{copy.quickStartHint}</Text>
        </View>
      </View>
      <Button variant="primary" label={copy.quickStartButton} trailingIcon="chevron-right" fullWidth style={{ marginTop: theme.spacing.md }} onPress={start} />
    </Panel>
  );
}

/** Creates projects from the old web app's saved state. Never touches the old key. */
async function importLegacy(data: LegacyData): Promise<void> {
  const { createPattern, createPicture, open } = useProjects.getState();
  const patternId = createPattern({
    stitchId: data.pattern.stitchId,
    name: getStitch(data.pattern.stitchId)?.name ?? copy.quickStartName,
    warps: data.warps,
    setup: data.pattern.setup,
    colors: data.pattern.colors,
    row: data.pattern.row,
  });
  let openId = patternId;
  if (data.picture) {
    try {
      const picked = await importPictureDataUrl(data.picture.src);
      const pictureId = createPicture({
        imageUri: picked.uri,
        imageW: picked.width,
        imageH: picked.height,
        rows: data.picture.rows,
        k: data.picture.k,
        tidy: data.picture.tidy,
        weave: data.picture.weave,
        row: data.picture.row,
        warps: data.warps,
      });
      if (data.mode === 'pic') openId = pictureId;
    } catch {
      // A picture that will not import is left behind; the pattern still comes over.
    }
  }
  open(openId);
}

function LegacyOffer({ legacy }: { legacy: LegacyData }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await importLegacy(legacy);
    } finally {
      useSettings.getState().setLegacyImportHandled();
      setBusy(false);
    }
  };

  return (
    <Panel testID="legacy-offer">
      <Text variant="heading">{copy.legacyTitle}</Text>
      <Text variant="hint" style={{ marginTop: theme.spacing.xs }}>
        {copy.legacyHint}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button variant="primary" label={copy.legacyAccept} icon="arrow-up-tray" disabled={busy} onPress={accept} />
        <Button label={copy.legacyDecline} disabled={busy} onPress={() => useSettings.getState().setLegacyImportHandled()} />
      </View>
    </Panel>
  );
}
