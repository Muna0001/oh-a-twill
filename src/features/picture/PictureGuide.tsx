import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { importPictureFile, messageFor, pickPicture, type PickedPicture, type PickSource } from '@/media';
import { useProject, useProjects, type PicturePatch, type PictureProject } from '@/store';
import { BottomBar, Button, EmptyState, Header, Panel, Screen, Stepper, Text, useTheme } from '@/ui';
import { LIMITS } from '@/engine';
import { PicturePreview } from '@/weave';

import { pictureCopy as copy } from './copy';
import { PicturePanel } from './PicturePanel';
import { RowCard } from './RowCard';
import { usePictureGrid } from './usePictureGrid';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/projects');
}

function Missing() {
  return (
    <Screen header={<Header title={copy.projectsTitle} onBack={goBack} />} edges={['top', 'bottom']}>
      <EmptyState
        testID="picture-missing"
        icon="photo"
        title={copy.missingTitle}
        message={copy.missingMessage}
        action={<Button label={copy.missingAction} onPress={() => router.replace('/projects')} />}
      />
    </Screen>
  );
}

/** The weaving guide for a picture project (PLAN.md 3.5). */
export function PictureGuide({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  if (!project || project.kind !== 'picture') return <Missing />;
  return <Guide project={project} />;
}

function Guide({ project }: { project: PictureProject }) {
  const theme = useTheme();
  const id = project.id;
  const { pic, status, error } = usePictureGrid(project);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    useProjects.getState().open(id);
  }, [id]);

  // HOOK(platform): useKeepAwake() from '@/platform' while the guide is open, when settings.keepAwake is on.

  const update = useCallback((patch: PicturePatch) => useProjects.getState().updatePicture(id, patch), [id]);

  const applyPicked = useCallback(
    (picked: PickedPicture | null) => {
      if (!picked) return;
      setPickError(null);
      update({ imageUri: picked.uri, imageW: picked.width, imageH: picked.height });
    },
    [update],
  );

  const runImport = useCallback(
    (load: () => Promise<PickedPicture | null>) => {
      setPicking(true);
      load()
        .then(applyPicked, (e: unknown) => setPickError(messageFor(e)))
        .finally(() => setPicking(false));
    },
    [applyPicked],
  );

  const onPick = useCallback((source: PickSource) => runImport(() => pickPicture(source)), [runImport]);
  const onDropFile = useCallback((file: File) => runImport(() => importPictureFile(file)), [runImport]);

  const ready = !!(project.imageUri && pic);
  const H = pic?.H ?? 0;
  const row = project.row;
  const finished = ready && row > H;
  const errorText = pickError ?? (status === 'error' ? messageFor(error) : null);

  const onPrev = () => {
    if (!ready || row <= 1) return;
    useProjects.getState().prevRow(id);
  };
  const onNext = () => {
    if (!ready || finished) return;
    // HOOK(platform): tapHaptic() from '@/platform' when settings.haptics is on.
    useProjects.getState().nextRow(id, H + 1);
  };
  // HOOK(platform): useRowKeys({ onPrev, onNext }) from '@/platform' (← and → on web).

  const footer = (
    <BottomBar
      testID="picture-bar"
      left={<Button size="lg" icon="chevron-left" label={copy.back} accessibilityLabel={copy.previousRow} disabled={!ready || row <= 1} onPress={onPrev} testID="picture-prev" />}
      center={ready ? (finished ? copy.finished : copy.row(row)) : ''}
      right={<Button size="lg" variant="primary" trailingIcon="chevron-right" label={copy.rowDone} disabled={!ready || finished} onPress={onNext} testID="picture-next" />}
    />
  );

  return (
    <Screen scroll header={<Header title={project.name} onBack={goBack} />} footer={footer}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.md }}>
          <View style={{ flexShrink: 1 }}>
            <Text variant="heading">{copy.warpTitle}</Text>
            <Text variant="hint">{copy.warpFit(project.warps)}</Text>
          </View>
          <Stepper
            value={project.warps}
            min={LIMITS.warps.min}
            max={LIMITS.warps.max}
            onChange={(warps) => update({ warps })}
            accessibilityLabel={copy.warpLabel}
            decrementLabel={copy.fewerWarps}
            incrementLabel={copy.moreWarps}
          />
        </View>
      </Panel>

      <Panel>
        <PicturePanel
          project={project}
          pic={pic}
          building={status === 'building'}
          error={errorText}
          picking={picking}
          onPick={onPick}
          onDropFile={onDropFile}
          onChange={update}
        />
      </Panel>

      {ready && pic ? (
        <>
          <RowCard pic={pic} weave={project.weave} row={row} onRestart={() => useProjects.getState().setRow(id, 1)} />
          <Panel>
            <Text variant="heading">{copy.previewTitle}</Text>
            <Text variant="hint" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
              {copy.previewHint}
            </Text>
            <PicturePreview testID="picture-preview" pic={pic} currentRow={row} onJump={(r) => useProjects.getState().setRow(id, Math.min(H, Math.max(1, r)), H)} />
          </Panel>
        </>
      ) : null}
    </Screen>
  );
}
