import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { getStitch } from '@/catalog';
import { period, rowInfo, stats, type Stitch } from '@/engine';
import { confirmAsync, scrollIntoView, tapHaptic, useKeepAwake, useRowKeys } from '@/platform';
import { useHydrated, useProject, useProjects, useSettings, type PatternProject } from '@/store';
import { BottomBar, Button, Collapsible, ColorField, EmptyState, Header, Icon, Panel, Screen, Text, useTheme } from '@/ui';
import {
  DirectionPill,
  Drawdown,
  EdgeTip,
  MathPanel,
  RepeatChips,
  StripScroller,
  WarpNumbers,
  WarpStrip,
  WeftTag,
  repeatLabels,
  stepsSentence,
  warpColorsFor,
  weaveCopy,
} from '@/weave';

import { guideCopy as copy } from './copy';

/** Narrower than this, the header's settings button shows only its icon. */
const COMPACT_HEADER_BELOW = 360;

/** Above this row, "Back to row 1" asks first. */
const CONFIRM_RESTART_ABOVE = 10;

function backToProjects() {
  if (router.canGoBack()) router.back();
  else router.replace('/projects');
}

/** /project/<id> for a pattern project (PLAN.md 3.4): one row at a time, the drawdown, the math. */
export function PatternGuide({ projectId }: { projectId: string }) {
  const hydrated = useHydrated();
  const project = useProject(projectId);
  const open = useProjects((s) => s.open);
  const exists = hydrated && !!project;

  // Once per project, after the stores have loaded (an earlier call would be overwritten).
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!exists || opened.current === projectId) return;
    opened.current = projectId;
    open(projectId);
  }, [exists, projectId, open]);

  if (!hydrated) return <Screen edges={['top', 'bottom']} />;
  if (!project || project.kind !== 'pattern') {
    return <Missing title={copy.notFoundTitle} message={copy.notFoundMessage} />;
  }
  const stitch = getStitch(project.stitchId);
  if (!stitch) return <Missing title={copy.unknownStitchTitle} message={copy.unknownStitchMessage} />;
  return <Guide project={project} stitch={stitch} />;
}

function Missing({ title, message }: { title: string; message: string }) {
  return (
    <Screen header={<Header title="" onBack={backToProjects} />} edges={['top', 'bottom']} testID="guide-missing">
      <EmptyState
        icon="queue-list"
        title={title}
        message={message}
        action={<Button variant="primary" label={copy.toProjects} onPress={() => router.replace('/projects')} />}
      />
    </Screen>
  );
}

function Guide({ project, stitch }: { project: PatternProject; stitch: Stitch }) {
  const theme = useTheme();
  const { id, row, warps, setup, colors } = project;
  const haptics = useSettings((s) => s.haptics);
  const keepAwake = useSettings((s) => s.keepAwake);
  const nextRow = useProjects((s) => s.nextRow);
  const prevRow = useProjects((s) => s.prevRow);
  const setRow = useProjects((s) => s.setRow);
  const updatePattern = useProjects((s) => s.updatePattern);
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const info = useMemo(() => rowInfo(stitch, setup, warps, row), [stitch, setup, warps, row]);
  const mathStats = useMemo(() => stats(stitch, setup, warps), [stitch, setup, warps]);
  const labels = useMemo(() => repeatLabels(stitch, setup, row), [stitch, setup, row]);
  const warpColors = useMemo(() => warpColorsFor(stitch, warps, colors), [stitch, warps, colors]);
  const P = period(stitch);
  const weftColor = colors[info.weftKey];
  const weftName = weaveCopy.colorName(info.weftKey);
  const first = info.runs[0];

  const setWeftColor = useCallback(
    (hex: string) => {
      const next: [string, string] = info.weftKey === 0 ? [hex, colors[1]] : [colors[0], hex];
      updatePattern(id, { colors: next });
    },
    [info.weftKey, colors, updatePattern, id],
  );

  /** Arrow keys (desktop): no haptic. */
  const goNext = useCallback(() => {
    nextRow(id);
    scrollIntoView(cardRef.current, scrollRef.current);
  }, [nextRow, id]);

  /** The Row done tap: the haptic is played synchronously, inside the tap (the web needs that). */
  const pressNext = useCallback(() => {
    if (haptics) tapHaptic();
    goNext();
  }, [haptics, goNext]);

  const goPrev = useCallback(() => {
    if (row <= 1) return;
    prevRow(id);
    scrollIntoView(cardRef.current, scrollRef.current);
  }, [prevRow, id, row]);

  const restart = useCallback(async () => {
    if (row > CONFIRM_RESTART_ABOVE) {
      const ok = await confirmAsync({
        title: copy.restartTitle,
        message: copy.restartMessage(row),
        confirmLabel: copy.restartConfirm,
        cancelLabel: copy.cancel,
      });
      if (!ok) return;
    }
    setRow(id, 1);
  }, [row, setRow, id]);

  const jump = useCallback((r: number) => setRow(id, r), [setRow, id]);

  useKeepAwake(keepAwake);
  useRowKeys(goPrev, goNext, focused);

  const header = (
    <Header
      title={project.name}
      titleVariant="subtitle"
      subtitle={stitch.name === project.name ? undefined : stitch.name}
      onBack={backToProjects}
      right={
        <Button
          icon="cog-6-tooth"
          label={width < COMPACT_HEADER_BELOW ? undefined : copy.setup}
          accessibilityLabel={copy.setup}
          accessibilityHint={copy.setupHint}
          onPress={() => router.push(`/project/${id}/setup`)}
          testID="guide-setup"
        />
      }
    />
  );

  const footer = (
    <BottomBar
      testID="guide-bar"
      left={<Button size="lg" icon="chevron-left" label={copy.back} accessibilityLabel={copy.previousRow} disabled={row <= 1} onPress={goPrev} testID="guide-prev" />}
      center={copy.row(row)}
      right={<Button size="lg" variant="primary" label={copy.rowDone} trailingIcon="chevron-right" onPress={pressNext} testID="guide-next" />}
    />
  );

  return (
    <Screen scroll scrollRef={scrollRef} header={header} footer={footer} testID="pattern-guide">
      <View ref={cardRef} accessibilityLiveRegion="polite" testID="guide-row-card">
        <Panel variant="hero" style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Text variant="display" accessibilityRole="header" testID="guide-row">
              {copy.row(row)}
            </Text>
            <DirectionPill ltr={info.ltr} testID="guide-direction" />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {P > 1 ? (
              <Text color="muted" testID="guide-repeat-line">
                {copy.repeatLine(info.repeatRow, P)}
              </Text>
            ) : null}
            <ColorField
              label={weftName}
              value={weftColor}
              onChange={setWeftColor}
              renderTrigger={(openSheet) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.weftButton(weftName)}
                  onPress={openSheet}
                  testID="guide-weft"
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    minHeight: theme.minTouch,
                    paddingRight: theme.spacing.xs,
                    borderRadius: theme.radii.button,
                    backgroundColor: pressed ? theme.colors.cloud : 'transparent',
                    cursor: 'pointer',
                  })}>
                  <WeftTag color={weftColor} label={weaveCopy.weft(weftName)} style={{ alignSelf: 'center' }} />
                  <Icon name="chevron-down" size={16} color="muted" />
                </Pressable>
              )}
            />
          </View>

          {labels ? <RepeatChips labels={labels} current={info.repeatRow} testID="guide-repeat" /> : null}

          <View style={{ gap: theme.spacing.sm }}>
            {/* The strip is a picture; screen readers hear the whole row as one sentence instead. */}
            <View accessible accessibilityRole="text" accessibilityLabel={stepsSentence(info.runs, row, info.ltr)} testID="guide-steps">
              <StripScroller count={warps} testID="guide-strip">
                <WarpStrip states={info.states} warpColors={warpColors} weftColor={weftColor} />
                <WarpNumbers count={warps} />
              </StripScroller>
            </View>
            {first ? (
              <Text variant="hint" tabular accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="guide-start">
                {copy.start(weaveCopy.word(first.over, first.n).toLowerCase(), first.from)}
              </Text>
            ) : null}
          </View>

          {info.edgeWarp != null ? <EdgeTip warp={info.edgeWarp} testID="guide-edge-tip" /> : null}

          {row > 1 ? <Button icon="arrow-path" label={copy.backToRow1} onPress={restart} testID="guide-restart" /> : null}
        </Panel>
      </View>

      <Panel>
        <Text variant="heading">{copy.drawdownTitle}</Text>
        <Text variant="hint" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
          {copy.drawdownHint}
        </Text>
        <Drawdown stitch={stitch} setup={setup} warps={warps} colors={colors} currentRow={row} onJump={jump} testID="guide-drawdown" />
      </Panel>

      <Panel>
        <Collapsible title={copy.mathTitle} testID="guide-math">
          <MathPanel stats={mathStats} warps={warps} colorWarpLength={stitch.warp?.length} />
        </Collapsible>
      </Panel>
    </Screen>
  );
}
