import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ApiError, api, message } from '../../api';
import { dropPost } from '../../cache';
import { BackIcon } from '../../icons';
import { OpenAppBanner } from '../../open-app-banner';
import { PostCard } from '../../post-card';
import type { Post } from '../../types';
import { ErrorText, Muted, colors } from '../../ui';

export default function PublicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [post, setPost] = useState<Post | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  }, [router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={leave} hitSlop={8}>
          <BackIcon />
        </Pressable>
      ),
    });
  }, [navigation, leave]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const found = await api<Post>(`/api/posts/${id}`);
      setPost(found);
      setMissing(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        await dropPost(id);
        setMissing(true);
        setPost(null);
        return;
      }
      setError(message(cause));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: 8 }}>
      {id ? <OpenAppBanner id={id} /> : null}
      {missing ? (
        <View style={{ padding: 16 }}>
          <Muted>Publication introuvable.</Muted>
        </View>
      ) : null}
      {!post && !missing ? (
        <View style={{ padding: 16, gap: 12 }}>
          {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator />}
        </View>
      ) : null}
      {post ? (
        <PostCard
          post={post}
          here
          onChange={setPost}
          onGone={leave}
        />
      ) : null}
    </ScrollView>
  );
}
