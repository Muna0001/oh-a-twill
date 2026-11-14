import { useLocalSearchParams } from 'expo-router';

import { ProjectSetupScreen } from '@/features/projects';

/** /project/new?stitch=<id> */
export default function NewProjectRoute() {
  const { stitch } = useLocalSearchParams<{ stitch?: string }>();
  return <ProjectSetupScreen stitchId={stitch} />;
}
