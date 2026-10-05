import { Platform } from 'react-native';
import { SaveFormat, manipulateAsync, type Action } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { avatarActions, portraitActions, type Frame } from './crop';
import { fromExif, readJpegGps } from './gps';
import type { Coords } from './types';

export type Draft = {
  uri: string;
  gps: Coords | null;
};

export async function preparePhoto(asset: ImagePickerAsset): Promise<Draft> {
  const gps = fromExif(asset.exif) ?? (await gpsFromUri(asset.uri));
  const saved = await manipulateAsync(asset.uri, asActions(portraitActions(asset.width, asset.height)), {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return { uri: saved.uri, gps };
}

export async function prepareAvatar(asset: ImagePickerAsset): Promise<string> {
  const saved = await manipulateAsync(asset.uri, asActions(avatarActions(asset.width, asset.height)), {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
}

export async function appendFile(form: FormData, uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, 'photo.jpg');
    return;
  }
  form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as never);
}

async function gpsFromUri(uri: string): Promise<Coords | null> {
  try {
    const response = await fetch(uri);
    return readJpegGps(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

function asActions(frames: Frame[]): Action[] {
  return frames as Action[];
}
