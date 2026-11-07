import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import type { ProfileView } from './profile-posts';

type Entry = { y: number; mode: ProfileView };

const memory = new Map<string, Entry>();

export function saveProfileScroll(key: string, entry: Entry): void {
  memory.set(key, entry);
}

export function loadProfileScroll(key: string): Entry | null {
  return memory.get(key) ?? null;
}

/** Garde la position de la grille (ou de la suite) au départ vers une publication. */
export function useProfileScrollMemory(
  key: string,
  mode: ProfileView,
  setMode: (mode: ProfileView) => void,
) {
  const ref = useRef<ScrollView>(null);
  const y = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pending = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      const saved = loadProfileScroll(key);
      if (saved) {
        setMode(saved.mode);
        pending.current = saved.y;
      }
      // La grille peut encore grandir (miniatures) : on réapplique un court instant.
      const stop = setTimeout(() => {
        pending.current = null;
      }, 700);
      return () => {
        clearTimeout(stop);
        saveProfileScroll(key, { y: y.current, mode: modeRef.current });
      };
    }, [key, setMode]),
  );

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    y.current = event.nativeEvent.contentOffset.y;
  }

  function onContentSizeChange() {
    if (pending.current == null) return;
    const target = pending.current;
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: target, animated: false });
    });
  }

  return { ref, onScroll, onContentSizeChange, scrollEventThrottle: 16 as const };
}
