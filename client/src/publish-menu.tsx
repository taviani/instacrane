import { ActionSheetIOS, Alert, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { message } from './api';
import { preparePhoto, type Draft } from './prepare';

export function openPublishPicker(onPicked: (photos: Draft[]) => void): void {
  if (Platform.OS === 'ios') {
    const kinds = ['library', 'camera', 'file'] as const;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Photothèque', 'Caméra', 'Fichier', 'Annuler'],
        cancelButtonIndex: 3,
        userInterfaceStyle: 'light',
      },
      (index) => {
        const kind = kinds[index];
        if (kind) void take(kind, onPicked);
      },
    );
    return;
  }
  if (Platform.OS === 'web') {
    void webFiles()
      .then((assets) => deliver(assets, onPicked))
      .catch((cause) => Alert.alert('Instacrane', message(cause)));
    return;
  }
  void take('library', onPicked);
}

async function deliver(assets: ImagePickerAsset[] | null, onPicked: (photos: Draft[]) => void) {
  if (!assets || assets.length === 0) return;
  const photos = await Promise.all(assets.slice(0, 20).map((asset) => preparePhoto(asset)));
  if (photos.length > 0) onPicked(photos);
}

async function take(kind: 'library' | 'camera' | 'file', onPicked: (photos: Draft[]) => void) {
  try {
    const photos = await taken(kind);
    if (photos) onPicked(photos);
  } catch (cause) {
    Alert.alert('Instacrane', message(cause));
  }
}

async function taken(kind: 'library' | 'camera' | 'file'): Promise<Draft[] | null> {
  const assets = await pick(kind);
  if (!assets || assets.length === 0) return null;
  return Promise.all(assets.slice(0, 20).map((asset) => preparePhoto(asset)));
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
      void Promise.all(list.map(fileAsset)).then(resolve, reject);
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
