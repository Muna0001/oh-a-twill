import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { tileRowName, type PatternSetup, type Side, type Stitch } from '@/engine';
import { getStitch, warpOrderText } from '@/catalog';
import { useProject, useProjects, useSettings, type PatternProject } from '@/store';
import { BottomBar, Button, ColorField, EmptyState, Header, Panel, Screen, Segmented, Stepper, Text, useTheme } from '@/ui';
import { TilePreview } from '@/weave';

import { copy } from './copy';
import { backOr, fitHint } from './helpers';
import { Field, TextField } from './parts';

const MIN_WARPS = 4;
const MAX_WARPS = 120;

type Values = { warps: number; setup: PatternSetup; colors: [string, string] };
type Patch = { warps?: number; setup?: Partial<PatternSetup>; colors?: [string, string] };

const mirrorOptions = [
  { value: 'shown', label: copy.setup.asShown },
  { value: 'mirrored', label: copy.setup.mirrored },
] as const;

const sideOptions = [
  { value: 'left', label: copy.setup.leftEdge },
  { value: 'right', label: copy.setup.rightEdge },
] as const;

/**
 * /project/new?stitch=<id> (nothing is saved until "Start weaving") and
 * /project/<id>/setup (every change is saved as it is made, under the store's reset rules).
 */
export function ProjectSetupScreen({ projectId, stitchId }: { projectId?: string; stitchId?: string }) {
  const project = useProject(projectId);

  if (projectId !== undefined) {
    if (!project) return <Missing title={copy.project.notFoundTitle} message={copy.project.notFoundMessage} label={copy.project.toProjects} to="/projects" />;
    if (project.kind === 'picture') {
      return (
        <Missing
          title={copy.setup.pictureTitle}
          message={copy.setup.pictureMessage}
          label={copy.setup.backToPicture}
          onPress={() => backOr(`/project/${project.id}`)}
        />
      );
    }
    const stitch = getStitch(project.stitchId);
    if (!stitch) return <Missing title={copy.setup.stitchNotFoundTitle} message={copy.setup.stitchNotFoundMessage} label={copy.setup.toStitches} to="/" />;
    return <EditSetup project={project} stitch={stitch} />;
  }

  const stitch = stitchId ? getStitch(stitchId) : undefined;
  if (!stitch) return <Missing title={copy.setup.stitchNotFoundTitle} message={copy.setup.stitchNotFoundMessage} label={copy.setup.toStitches} to="/" />;
  return <NewSetup stitch={stitch} />;
}

function Missing({ title, message, label, to, onPress }: { title: string; message: string; label: string; to?: '/' | '/projects'; onPress?: () => void }) {
  return (
    <Screen edges={['top', 'bottom']} header={<CloseHeader title={title} onClose={onPress ?? (() => backOr(to ?? '/'))} />}>
      <EmptyState
        title={title}
        message={message}
        action={<Button variant="primary" label={label} onPress={onPress ?? (() => router.replace(to ?? '/'))} />}
      />
    </Screen>
  );
}

function CloseHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <Header title={title} right={<Button variant="link" icon="x-mark" accessibilityLabel={copy.setup.close} onPress={onClose} />} />;
}

function NewSetup({ stitch }: { stitch: Stitch }) {
  const createPattern = useProjects((s) => s.createPattern);
  const open = useProjects((s) => s.open);
  const [values, setValues] = useState<Values>(() => {
    const settings = useSettings.getState();
    return {
      warps: settings.defaultWarps,
      setup: { start: 0, mirror: false, side: settings.defaultSide },
      colors: [settings.defaultColors[0], settings.defaultColors[1]],
    };
  });
  const [name, setName] = useState('');

  const apply = (patch: Patch) =>
    setValues((v) => ({
      warps: patch.warps ?? v.warps,
      setup: { ...v.setup, ...patch.setup },
      colors: patch.colors ?? v.colors,
    }));

  const start = () => {
    const id = createPattern({
      stitchId: stitch.id,
      name: name.trim() || stitch.name,
      warps: values.warps,
      setup: values.setup,
      colors: values.colors,
    });
    open(id);
    router.replace(`/project/${id}`);
  };

  return (
    <SetupForm
      title={copy.setup.newTitle}
      stitch={stitch}
      values={values}
      onChange={apply}
      name={name}
      onName={setName}
      primary={copy.setup.startWeaving}
      onPrimary={start}
      onClose={() => backOr(`/stitch/${stitch.id}`)}
    />
  );
}

function EditSetup({ project, stitch }: { project: PatternProject; stitch: Stitch }) {
  const updatePattern = useProjects((s) => s.updatePattern);
  const rename = useProjects((s) => s.rename);
  const [name, setName] = useState(project.name);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== project.name) rename(project.id, next);
    else setName(project.name);
  };
  const finish = () => {
    commitName();
    backOr(`/project/${project.id}`);
  };

  return (
    <SetupForm
      title={copy.setup.editTitle}
      stitch={stitch}
      values={{ warps: project.warps, setup: project.setup, colors: project.colors }}
      onChange={(patch) => updatePattern(project.id, patch)}
      name={name}
      onName={setName}
      onNameCommit={commitName}
      row={project.row}
      existing
      primary={copy.setup.done}
      onPrimary={finish}
      onClose={finish}
    />
  );
}

type SetupFormProps = {
  title: string;
  stitch: Stitch;
  values: Values;
  onChange: (patch: Patch) => void;
  name: string;
  onName: (name: string) => void;
  onNameCommit?: () => void;
  /** Current row of an existing project. */
  row?: number;
  existing?: boolean;
  primary: string;
  onPrimary: () => void;
  onClose: () => void;
};

function SetupForm({ title, stitch, values, onChange, name, onName, onNameCommit, row = 1, existing = false, primary, onPrimary, onClose }: SetupFormProps) {
  const theme = useTheme();
  const { warps, setup, colors } = values;
  const tileRows = stitch.tile.length;
  const windOrder = warpOrderText(stitch);

  return (
    <Screen
      scroll
      header={<CloseHeader title={title} onClose={onClose} />}
      footer={<BottomBar center={<Button variant="primary" size="lg" fullWidth label={primary} onPress={onPrimary} />} />}>
      <Panel>
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'flex-start' }}>
          <TilePreview stitch={stitch} colors={colors} mirror={setup.mirror} cols={16} rows={12} style={{ width: 96 }} testID="setup-preview" />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="heading">{stitch.name}</Text>
            <Text variant="hint">{stitch.desc}</Text>
            {existing ? (
              <Text variant="hint" style={{ marginTop: theme.spacing.xs }}>
                {copy.setup.differentStitch}
              </Text>
            ) : null}
          </View>
        </View>
      </Panel>

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text variant="heading">{copy.setup.warpTitle}</Text>
            <Text variant="hint" testID="fit-hint">
              {fitHint(stitch, warps)}
            </Text>
          </View>
          <Stepper
            value={warps}
            min={MIN_WARPS}
            max={MAX_WARPS}
            onChange={(n) => onChange({ warps: n })}
            accessibilityLabel={copy.setup.warpLabel}
            decrementLabel={copy.setup.fewerWarps}
            incrementLabel={copy.setup.moreWarps}
          />
        </View>
      </Panel>

      <Panel style={{ gap: theme.spacing.xl }}>
        {tileRows > 1 ? (
          <Field label={copy.setup.startOn} hint={existing && row > 1 ? copy.setup.startResets(row) : undefined}>
            <View accessibilityRole="radiogroup" accessibilityLabel={copy.setup.startOn} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {Array.from({ length: tileRows }, (_, k) => (
                <Button
                  key={k}
                  label={tileRowName(stitch, setup, k)}
                  selected={k === setup.start}
                  onPress={() => {
                    if (k !== setup.start) onChange({ setup: { start: k } });
                  }}
                />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label={copy.setup.yarnColors} hint={windOrder ? copy.setup.windOrder(windOrder) : undefined}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xl }}>
            <ColorField label={copy.setup.colorA} value={colors[0]} onChange={(hex) => onChange({ colors: [hex, colors[1]] })} />
            <ColorField label={copy.setup.colorB} value={colors[1]} onChange={(hex) => onChange({ colors: [colors[0], hex] })} />
          </View>
        </Field>

        <Field label={copy.setup.direction}>
          <Segmented
            accessibilityLabel={copy.setup.direction}
            options={mirrorOptions}
            value={setup.mirror ? 'mirrored' : 'shown'}
            onChange={(v) => onChange({ setup: { mirror: v === 'mirrored' } })}
          />
        </Field>

        <Field label={copy.setup.rowOneStarts}>
          <Segmented<Side>
            accessibilityLabel={copy.setup.rowOneStarts}
            options={sideOptions}
            value={setup.side}
            onChange={(side) => onChange({ setup: { side } })}
          />
        </Field>

        <Field label={copy.setup.nameLabel} hint={existing ? undefined : copy.setup.nameHint}>
          <View style={{ flexDirection: 'row' }}>
            <TextField
              accessibilityLabel={copy.setup.nameLabel}
              value={name}
              onChangeText={onName}
              placeholder={stitch.name}
              onBlur={onNameCommit}
              onSubmit={onNameCommit}
            />
          </View>
        </Field>
      </Panel>
    </Screen>
  );
}
