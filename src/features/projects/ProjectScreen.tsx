import { Text, View } from 'react-native';

/** Placeholder. Replaced by the owning work package. */
export function ProjectScreen({ id }: { id: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text>Project {id}</Text>
    </View>
  );
}
