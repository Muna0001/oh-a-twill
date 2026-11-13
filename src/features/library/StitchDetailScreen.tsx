import { Text, View } from 'react-native';

/** Placeholder. Replaced by the owning work package. */
export function StitchDetailScreen({ id }: { id: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text>Stitch {id}</Text>
    </View>
  );
}
