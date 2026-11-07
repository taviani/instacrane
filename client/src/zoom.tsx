import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type ZoomPhoto = {
  key: string;
  url: string;
  renew?: () => Promise<string | null>;
};

type ZoomControls = {
  photo: ZoomPhoto | null;
  held: boolean;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  begin: (photo: ZoomPhoto) => void;
  end: () => void;
  close: () => void;
};

const ZoomContext = createContext<ZoomControls | null>(null);

export function ZoomProvider({ children }: { children: ReactNode }) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const [photo, setPhoto] = useState<ZoomPhoto | null>(null);
  const [held, setHeld] = useState(false);

  function reset() {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
  }

  function begin(next: ZoomPhoto) {
    reset();
    setPhoto(next);
    setHeld(true);
  }

  function end() {
    if (scale.value <= 1.05) {
      reset();
      setHeld(false);
      setPhoto(null);
      return;
    }
    setHeld(false);
  }

  function close() {
    reset();
    setHeld(false);
    setPhoto(null);
  }

  return <ZoomContext.Provider value={{ photo, held, scale, tx, ty, begin, end, close }}>{children}</ZoomContext.Provider>;
}

export function useZoom(): ZoomControls {
  const zoom = useContext(ZoomContext);
  if (!zoom) throw new Error('zoom absent');
  return zoom;
}
