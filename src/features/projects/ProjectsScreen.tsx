import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { getStitch } from '@/catalog';
import { thumbnailSource } from '@/media';
import { useProjectList, useProjects, useSettings, type Project } from '@/store';
import { Button, Chip, EmptyState, Header, Icon, Screen, Sheet, Text, TextField, useTheme } from '@/ui';
import { TilePreview } from '@/weave';

import { copy } from './copy';
import { pictureHeight, shortDate } from './helpers';

const THUMB = 64;

/** The Projects tab: every saved weaving, most recent first. */
export function ProjectsScreen() {
  const theme = useTheme();
  const projects = useProjectList();
  const createPicture = useProjects((s) => s.createPicture);
  const open = useProjects((s) => s.open);
  const [menuId, setMenuId] = useState<string | null>(null);

  const openProject = (id: string) => {
    open(id);
    router.push(`/project/${id}`);
  };
  const newFromPicture = () => {
    const id = createPicture({ warps: useSettings.getState().defaultWarps });
    openProject(id);
  };

  return (
    <Screen scroll header={<Header title={copy.projects.title} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <Button variant="primary" icon="photo" label={copy.projects.newFromPicture} onPress={newFromPicture} />
        <Button icon="squares-2x2" label={copy.projects.newFromStitch} onPress={() => router.navigate('/')} />
      </View>

      {projects.length === 0 ? (
        <EmptyState icon="queue-list" title={copy.projects.emptyTitle} message={copy.projects.emptyMessage} />
      ) : (
        // One floated card holds the whole list; rows are split by hairlines.
        <View testID="project-list" style={[theme.cards.card, { paddingVertical: theme.spacing.xs }]}>
          {projects.map((p, i) => (
            <ProjectRow key={p.id} project={p} first={i === 0} onOpen={() => openProject(p.id)} onMore={() => setMenuId(p.id)} />
          ))}
        </View>
      )}

      <ProjectMenu id={menuId} onClose={() => setMenuId(null)} />
    </Screen>
  );
}

function statusFor(p: Project): { text: string; finished: boolean } {
  if (p.kind === 'pattern') return { text: copy.projects.status(p.row, p.warps), finished: false };
  const H = pictureHeight(p);
  if (!p.imageUri) return { text: copy.projects.noPicture, finished: false };
  if (H !== null && p.row > H) return { text: copy.projects.finished(p.warps), finished: true };
  return { text: copy.projects.status(p.row, p.warps), finished: false };
}

function ProjectRow({ project, first, onOpen, onMore }: { project: Project; first: boolean; onOpen: () => void; onMore: () => void }) {
  const theme = useTheme();
  const status = statusFor(project);
  const date = shortDate(project.updatedAt);
  return (
    <View
      testID={`project-row-${project.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.line,
        marginHorizontal: theme.spacing.lg,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${project.name}, ${status.text}, ${copy.projects.lastWoven(date)}`}
        accessibilityHint={copy.projects.open(project.name)}
        onPress={onOpen}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          paddingVertical: theme.spacing.lg,
          cursor: 'pointer',
          opacity: pressed ? 0.7 : 1,
        })}>
        <Thumbnail project={project} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text weight="semibold" numberOfLines={1}>
            {project.name}
          </Text>
          {status.finished ? (
            <Chip tone="mint" icon="check" label={status.text} testID={`project-finished-${project.id}`} style={{ marginVertical: 2 }} />
          ) : (
            <Text variant="hint" tabular numberOfLines={1}>
              {status.text}
            </Text>
          )}
          <Text variant="hint" numberOfLines={1}>
            {date}
          </Text>
        </View>
      </Pressable>
      <Button variant="link" icon="ellipsis-horizontal" accessibilityLabel={copy.projects.more(project.name)} onPress={onMore} style={{ alignSelf: 'center', marginRight: -theme.spacing.sm }} />
    </View>
  );
}

function Thumbnail({ project }: { project: Project }) {
  const theme = useTheme();
  const frame = {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radii.field,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (project.kind === 'pattern') {
    const stitch = getStitch(project.stitchId);
    return (
      <View style={frame}>
        {stitch ? (
          <TilePreview stitch={stitch} colors={project.colors} mirror={project.setup.mirror} cols={10} rows={10} style={{ width: THUMB, borderRadius: 0 }} />
        ) : (
          <Icon name="squares-2x2" color="muted" />
        )}
      </View>
    );
  }
  return (
    <View style={frame}>
      {project.imageUri ? <PictureThumb uri={project.imageUri} /> : <Icon name="photo" size={28} color="muted" />}
    </View>
  );
}

function PictureThumb({ uri }: { uri: string }) {
  const [src, setSrc] = useState<{ uri: string; for: string } | null>(null);
  useEffect(() => {
    let live = true;
    thumbnailSource(uri).then(
      (s) => {
        if (live) setSrc({ uri: s, for: uri });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [uri]);
  if (!src || src.for !== uri) return <Icon name="photo" size={28} color="muted" />;
  return <Image source={{ uri: src.uri }} resizeMode="cover" style={{ width: THUMB, height: THUMB }} accessibilityIgnoresInvertColors />;
}

/** The "more" sheet for one project: rename, duplicate, delete (with a confirm step). */
function ProjectMenu({ id, onClose }: { id: string | null; onClose: () => void }) {
  const project = useProjects((s) => (id ? s.projects[id] : undefined));
  const rename = useProjects((s) => s.rename);
  const duplicate = useProjects((s) => s.duplicate);
  const remove = useProjects((s) => s.remove);
  const theme = useTheme();
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);

  // Reset the sheet's fields whenever it opens for a different project.
  if (id !== shownFor) {
    setShownFor(id);
    setName(project?.name ?? '');
    setConfirming(false);
  }

  if (!id || !project) return <Sheet visible={false} onClose={onClose} title="" />;

  const saveName = () => {
    if (name.trim()) rename(project.id, name.trim());
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={project.name} testID="project-menu">
      {confirming ? (
        <View style={{ gap: theme.spacing.lg }}>
          <Text>{copy.projects.deleteConfirm(project.name)}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button label={copy.projects.cancel} onPress={() => setConfirming(false)} />
            <Button
              variant="primary"
              icon="trash"
              label={copy.projects.deleteYes}
              accessibilityLabel={`${copy.projects.deleteYes} “${project.name}”`}
              onPress={() => {
                remove(project.id);
                onClose();
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label">{copy.projects.renameLabel}</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <TextField style={{ flex: 1 }} accessibilityLabel={copy.projects.renameLabel} value={name} onChangeText={setName} onSubmit={saveName} />
              <Button icon="pencil" label={copy.projects.renameSave} onPress={saveName} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Button
              icon="document-duplicate"
              label={copy.projects.duplicate}
              onPress={() => {
                duplicate(project.id);
                onClose();
              }}
            />
            <Button icon="trash" label={copy.projects.delete} onPress={() => setConfirming(true)} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
