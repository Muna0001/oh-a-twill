import { Text, View } from 'react-native';

/** Placeholder. Replaced by the owning work package. */
export function ProjectSetupScreen({ projectId, stitchId }: { projectId?: string; stitchId?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text>Setup {projectId ?? stitchId ?? 'new'}</Text>
    </View>
  );
}
