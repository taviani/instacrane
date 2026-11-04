import { useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { message } from './api';
import { preparePhoto, type Draft } from './prepare';
import { ErrorText, colors } from './ui';

export function PublishMenu({
  visible,
  onClose,
  onPicked,
}: {
  visible: boolean;
  onClose: () => void;
  onPicked: (photos: Draft[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function choose(kind: 'library' | 'camera' | 'file') {
    setError(null);
    try {
      const assets = await pick(kind);
      if (!assets || assets.length === 0) return;
      const photos = await Promise.all(assets.slice(0, 20).map((asset) => preparePhoto(asset)));
      onClose();
      onPicked(photos);
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Annuler" onPress={onClose} style={{ flex: 1 }} />
        <View style={{ backgroundColor: colors.bg, padding: 8, gap: 8 }}>
          <Choice label="Photothèque" onPress={() => void choose('library')} />
          <Choice label="Caméra" onPress={() => void choose('camera')} />
          <Choice label="Fichier" onPress={() => void choose('file')} />
          <Choice label="Annuler" onPress={onClose} />
          <ErrorText>{error}</ErrorText>
        </View>
      </View>
    </Modal>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: label === 'Photothèque' ? 0 : 1, borderTopColor: colors.line }}
    >
      <Text style={{ fontSize: 17 }}>{label}</Text>
    </Pressable>
  );
}

async function pick(kind: 'library' | 'camera' | 'file'): Promise<ImagePickerAsset[] | null> {
  if (kind === 'file') return pickFiles();
  if (kind === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('La caméra reste indisponible.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: true, quality: 1 });
    if (result.canceled) return null;
    return result.assets;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 20,
    exif: true,
    quality: 1,
  });
  if (result.canceled) return null;
  return result.assets.filter((asset) => asset.type !== 'video');
}

async function pickFiles(): Promise<ImagePickerAsset[] | null> {
  if (Platform.OS === 'web') return webFiles();
  const picker = await import('expo-document-picker');
  const result = await picker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return Promise.all(result.assets.slice(0, 20).map(async (asset) => {
    const size = await measure(asset.uri);
    return { uri: asset.uri, width: size.width, height: size.height, mimeType: asset.mimeType ?? undefined };
  }));
}

function webFiles(): Promise<ImagePickerAsset[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = true;
    let settled = false;
    const finish = (files: FileList | null) => {
      if (settled) return;
      settled = true;
      const list = [...(files ?? [])].slice(0, 20);
      if (list.length === 0) {
        resolve(null);
        return;
      }
      void Promise.all(list.map(fileAsset)).then(resolve);
    };
    input.onchange = () => finish(input.files);
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}

async function fileAsset(file: File): Promise<ImagePickerAsset> {
  const uri = URL.createObjectURL(file);
  const size = await measure(uri);
  return { uri, width: size.width, height: size.height, mimeType: file.type };
}

function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}
