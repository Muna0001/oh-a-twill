import { useLocalSearchParams } from 'expo-router';

import { StitchDetailScreen } from '@/features/library';

export default function StitchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StitchDetailScreen id={id} />;
}
