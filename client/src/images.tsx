import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cachedUri, dropKey, storeImage } from './cache';
import { HeartIcon } from './icons';
import { StackMark, colors } from './ui';

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
          <Zoomable key={photo.key} width={width} onLike={liked}>
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

function Zoomable({ children, onLike }: { children: ReactNode; width: number; onLike: () => void }) {
  const scale = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(4, Math.max(1, event.scale));
    })
    .onEnd(() => {
      scale.value = withTiming(1);
    });
  const tap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      runOnJS(onLike)();
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(Gesture.Native(), pinch, tap)}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
