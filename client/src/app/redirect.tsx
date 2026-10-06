import { ActivityIndicator, View } from 'react-native';

export default function RedirectScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <ActivityIndicator />
    </View>
  );
}
