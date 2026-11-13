import { Text, View } from 'react-native';

/** Placeholder. Replaced by the owning work package. */
export function PictureGuide({ projectId }: { projectId: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text>Picture guide {projectId}</Text>
    </View>
  );
}
