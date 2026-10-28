import { Galeria } from '@nandorojo/galeria';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const url = 'https://picsum.photos/id/10/1200/800';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Tap the image. With theme="light" the fullscreen viewer should be WHITE.
        If it is black, the theme prop was dropped.
      </Text>
      <Galeria urls={[url]} theme="light">
        <Galeria.Image index={0}>
          <Image testID="thumbnail" source={{ uri: url }} style={styles.image} />
        </Galeria.Image>
      </Galeria>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  text: { fontSize: 16, textAlign: 'center' },
  image: { width: 300, height: 200 },
});
