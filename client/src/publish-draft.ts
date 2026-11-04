import type { Draft } from './prepare';
import type { Coords } from './types';

let pending: Draft[] | null = null;
const listeners = new Set<(photos: Draft[]) => void>();

export function stageDrafts(photos: Draft[]): void {
  if (listeners.size === 0) {
    pending = photos;
    return;
  }
  pending = null;
  for (const listener of listeners) listener(photos);
}

export function takeDrafts(): Draft[] | null {
  const photos = pending;
  pending = null;
  return photos;
}

export function subscribeDrafts(listener: (photos: Draft[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const photoPlaces = new Map<string, Coords>();

export function rememberPhotoPlace(id: string, photos: Draft[]): void {
  const found = photos.find((photo) => photo.gps);
  if (found?.gps) photoPlaces.set(id, found.gps);
}

export function photoPlaceFor(id: string): Coords | null {
  return photoPlaces.get(id) ?? null;
}
