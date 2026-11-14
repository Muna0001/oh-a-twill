import { useLocalSearchParams } from 'expo-router';

import { ProjectScreen } from '@/features/projects';

export default function ProjectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectScreen id={id} />;
}
