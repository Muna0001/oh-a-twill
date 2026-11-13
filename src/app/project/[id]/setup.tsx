import { useLocalSearchParams } from 'expo-router';

import { ProjectSetupScreen } from '@/features/projects';

export default function ProjectSetupRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectSetupScreen projectId={id} />;
}
