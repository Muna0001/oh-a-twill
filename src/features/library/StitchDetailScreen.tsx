import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { CATEGORIES, getStitch, warpOrderText, weftOrderText } from '@/catalog';
import { DEFAULTS, repWidth, stats, type Stitch } from '@/engine';
import { useSettings } from '@/store';
import { BottomBar, Button, EmptyState, Header, Icon, Panel, Screen, Segmented, Stepper, Text, useTheme } from '@/ui';
import { MathPanel, RepeatList, TilePreview } from '@/weave';

import { libraryCopy as copy } from './copy';
import { DifficultyDots } from './parts';

type Face = 'front' | 'back';

const FACES = [
  { value: 'front', label: copy.front, accessibilityLabel: copy.frontA11y },
  { value: 'back', label: copy.back, accessibilityLabel: copy.backA11y },
] as const;

const MIN_WARPS = 4;
const MAX_WARPS = 120;

export function StitchDetailScreen({ id }: { id: string }) {
  const stitch = getStitch(id);
  if (!stitch) return <NotFound />;
  return <StitchDetail stitch={stitch} />;
}

function NotFound() {
  return (
    <Screen header={<Header title="" back />} edges={['top', 'bottom']}>
      <EmptyState
        testID="stitch-not-found"
        icon="magnifying-glass"
        title={copy.notFoundTitle}
        message={copy.notFoundMessage}
        action={<Button label={copy.backToLibrary} icon="chevron-left" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}

function FavouriteToggle({ stitchId }: { stitchId: string }) {
  const on = useSettings((s) => s.favourites.includes(stitchId));
  const toggle = useSettings((s) => s.toggleFavourite);
  return (
    <Button variant="link" accessibilityLabel={on ? copy.removeFavorite : copy.addFavorite} selected={on} onPress={() => toggle(stitchId)} testID="favourite-toggle">
      <Icon name="heart" size={24} filled={on} color={on ? 'weft' : 'ink'} />
    </Button>
  );
}

function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <Panel testID={testID}>
      <Text variant="heading" style={{ marginBottom: theme.spacing.md }}>
        {title}
      </Text>
      {children}
    </Panel>
  );
}

function StitchDetail({ stitch }: { stitch: Stitch }) {
  const theme = useTheme();
  const colors = useSettings((s) => s.defaultColors);
  const defaultWarps = useSettings((s) => s.defaultWarps);
  const [face, setFace] = useState<Face>('front');
  const [warps, setWarps] = useState(defaultWarps);

  const rep = repWidth(stitch);
  const math = useMemo(() => stats(stitch, DEFAULTS.setup, warps), [stitch, warps]);
  const warpOrder = warpOrderText(stitch);
  const weftOrder = weftOrderText(stitch);

  return (
    <Screen
      scroll
      header={<Header title={stitch.name} titleVariant="subtitle" subtitle={CATEGORIES.find((c) => c.id === stitch.category)?.label} back right={<FavouriteToggle stitchId={stitch.id} />} />}
      footer={
        <BottomBar
          center={
            <Button
              variant="primary"
              size="lg"
              fullWidth
              label={copy.startWeaving}
              trailingIcon="chevron-right"
              onPress={() => router.push(`/project/new?stitch=${stitch.id}`)}
              testID="start-weaving"
            />
          }
        />
      }>
      <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xl, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <View style={[theme.cards.card, { padding: theme.spacing.md }]}>
          <TilePreview
            stitch={stitch}
            colors={colors}
            cols={24}
            rows={18}
            face={face}
            accessibilityLabel={copy.previewLabel(stitch.name, face)}
            style={{ borderRadius: theme.radii.field }}
            testID="detail-preview"
          />
        </View>
        <Segmented options={FACES} value={face} onChange={setFace} accessibilityLabel={copy.faceLabel} />
      </View>

      <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
        {stitch.aliases.length > 0 ? <Text color="muted">{copy.alsoCalled(stitch.aliases)}</Text> : null}
        <Text>{stitch.desc}</Text>
        <DifficultyDots level={stitch.difficulty} size={9} testID="detail-difficulty" />
        <View>
          <Text variant="label">{copy.goodFor}</Text>
          <Text>{stitch.goodFor}</Text>
        </View>
      </View>

      {warpOrder || weftOrder ? (
        <Section title={copy.colorOrderTitle} testID="color-order">
          <View style={{ gap: theme.spacing.sm }}>
            {warpOrder ? <Text>{copy.warpOrder(warpOrder)}</Text> : null}
            {weftOrder ? <Text>{copy.weftOrder(weftOrder)}</Text> : null}
          </View>
        </Section>
      ) : null}

      <Section title={copy.repeatTitle}>
        <RepeatList stitch={stitch} setup={DEFAULTS.setup} colors={colors} />
      </Section>

      <Section title={copy.mathTitle} testID="math">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <View style={{ flexShrink: 1 }}>
            <Text weight="semibold">{copy.warpThreads}</Text>
            <Text variant="hint" testID="warp-fit">
              {copy.fit(warps, rep)}
            </Text>
          </View>
          <Stepper
            value={warps}
            min={MIN_WARPS}
            max={MAX_WARPS}
            onChange={setWarps}
            accessibilityLabel={copy.warpInput}
            decrementLabel={copy.fewerWarps}
            incrementLabel={copy.moreWarps}
          />
        </View>
        <MathPanel stats={math} warps={warps} colorWarpLength={stitch.warp?.length} />
      </Section>

      <Section title={copy.tipsTitle}>
        <View accessibilityRole="list" style={{ gap: theme.spacing.sm }}>
          {stitch.tips.map((tip) => (
            <View key={tip} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Text color="muted">•</Text>
              <Text style={{ flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
