import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, View, useWindowDimensions, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { cachedUri, dropKey, storeImage } from './cache';
import { HeartIcon } from './icons';
import { StackMark, colors } from './ui';
import { useZoom, type ZoomPhoto } from './zoom';

export function CachedImage({
  name,
  url,
  renew,
  style,
  contentFit = 'cover',
}: {
  name: string;
  url: string | null | undefined;
  renew?: () => Promise<string | null>;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const renewRef = useRef(renew);
  renewRef.current = renew;
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const hit = await cachedUri(name);
      if (cancel) return;
      if (hit) {
        setUri(hit);
        return;
      }
      let source = url ?? null;
      for (let attempt = 0; attempt < 2 && source; attempt += 1) {
        try {
          const saved = await storeImage(name, source);
          if (!cancel) setUri(saved);
          return;
        } catch {
          source = attempt === 0 && renewRef.current ? await renewRef.current() : null;
          if (!source) await dropKey(name);
        }
      }
      if (!cancel) setUri(null);
    })();
    return () => {
      cancel = true;
    };
  }, [name, url]);

  if (!uri) return <View style={[style, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }]} />;
  return <Image source={{ uri }} style={style} contentFit={contentFit} cachePolicy="memory" />;
}

export function PhotoPager({
  photos,
  onLike,
}: {
  photos: { key: string; url: string; renew?: () => Promise<string | null> }[];
  onLike: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [heart, setHeart] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function liked() {
    setHeart(true);
    onLike();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHeart(false), 700);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: width || '100%' }}
      >
        {photos.map((photo) => (
          <Zoomable key={photo.key} photo={photo} onLike={liked}>
            <CachedImage name={photo.key} url={photo.url} renew={photo.renew} style={{ width: width || '100%', aspectRatio: 4 / 5 }} />
          </Zoomable>
        ))}
      </ScrollView>
      {photos.length > 1 ? <StackMark /> : null}
      {heart ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <HeartIcon color="#ffffff" size={88} filled />
        </View>
      ) : null}
    </View>
  );
}

function Zoomable({ children, photo, onLike }: { children: ReactNode; photo: ZoomPhoto; onLike: () => void }) {
  const zoom = useZoom();
  const scale = zoom.scale;
  const begin = zoom.begin;
  const end = zoom.end;
  const pinch = Gesture.Pinch()
    .onStart(() => {
      runOnJS(begin)({ key: photo.key, url: photo.url });
    })
    .onUpdate((event) => {
      scale.value = Math.min(4, Math.max(1, event.scale));
    })
    .onEnd(() => {
      runOnJS(end)();
    });
  const tap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      runOnJS(onLike)();
    });
  return (
    <GestureDetector gesture={Gesture.Simultaneous(Gesture.Native(), pinch, tap)}>
      <Animated.View>{children}</Animated.View>
    </GestureDetector>
  );
}

export function ZoomSurface() {
  const zoom = useZoom();
  const { width, height } = useWindowDimensions();
  const scale = zoom.scale;
  const tx = zoom.tx;
  const ty = zoom.ty;
  const close = zoom.close;
  const origin = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const frame = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      origin.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(4, Math.max(1, origin.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.05) runOnJS(close)();
    });
  const pan = Gesture.Pan()
    .onBegin(() => {
      panX.value = tx.value;
      panY.value = ty.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      tx.value = panX.value + event.translationX;
      ty.value = panY.value + event.translationY;
    });
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(close)();
  });
  if (!zoom.photo) return null;
  return (
    <View
      pointerEvents={zoom.held ? 'none' : 'auto'}
      style={{
        position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GestureDetector gesture={Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), tap)}>
        <Animated.View style={[{ width, height }, frame]}>
          <CachedImage
            name={zoom.photo.key}
            url={zoom.photo.url}
            renew={zoom.photo.renew}
            contentFit="contain"
            style={{ width, height }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
