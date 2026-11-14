import { ScrollView, View, useWindowDimensions } from 'react-native';

import { GalleryScreen } from '@/ui';
import { WeaveGallery } from '@/weave';

/** Dev page: the design-system gallery (one screen tall, scrolls inside), then the weave components below it. */
export default function Gallery() {
  const { height } = useWindowDimensions();
  return (
    <ScrollView testID="gallery-scroll" style={{ flex: 1 }}>
      <View style={{ height }}>
        <GalleryScreen />
      </View>
      <WeaveGallery />
    </ScrollView>
  );
}
