import { router } from 'expo-router';

import { PatternGuide } from '@/features/guide';
import { PictureGuide } from '@/features/picture';
import { useProject } from '@/store';
import { Button, EmptyState, Screen } from '@/ui';

import { copy } from './copy';

/** /project/<id>: the weaving guide for the project's kind, or a not-found state. */
export function ProjectScreen({ id }: { id: string }) {
  const project = useProject(id);
  if (project?.kind === 'pattern') return <PatternGuide projectId={project.id} />;
  if (project?.kind === 'picture') return <PictureGuide projectId={project.id} />;
  return (
    <Screen edges={['top', 'bottom']}>
      <EmptyState
        icon="queue-list"
        title={copy.project.notFoundTitle}
        message={copy.project.notFoundMessage}
        action={<Button variant="primary" label={copy.project.toProjects} onPress={() => router.replace('/projects')} />}
      />
    </Screen>
  );
}
