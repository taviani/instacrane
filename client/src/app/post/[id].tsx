import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api, message } from '../../api';
import { dropPost } from '../../cache';
import { useSession } from '../../session';
import { cursor, runes } from '../../text';
import type { Comment, Post } from '../../types';
import { Button, ErrorText, Field, Muted, colors } from '../../ui';

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, reloadBell } = useSession();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboard(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const found = await api<Post>(`/api/posts/${id}`);
      setPost(found);
      setComments(found.comments ?? []);
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

  async function sendComment() {
    const text = body.trim();
    if (!id || !text || runes(text) > 1000) {
      setError('commentaire invalide');
      return;
    }
    setError(null);
    try {
      const created = await api<Comment>(`/api/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setComments((current) => [...current, created]);
      setPost((current) => (current ? { ...current, comments_count: current.comments_count + 1 } : current));
      setBody('');
      await reloadBell();
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function removeComment(commentId: string) {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/posts/${id}/comments/${commentId}`, { method: 'DELETE' });
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setPost((current) => (current ? { ...current, comments_count: Math.max(0, current.comments_count - 1) } : current));
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function moreComments() {
    if (!id) return;
    const last = comments.at(-1);
    if (!last) return;
    const query = new URLSearchParams({ limit: '30', after: cursor(last.created_at, last.id) });
    const page = await api<{ comments: Comment[] }>(`/api/posts/${id}/comments?${query}`);
    setComments((current) => [...current, ...(page.comments ?? [])]);
  }

  if (missing) {
    return (
      <View style={{ padding: 16 }}>
        <Muted>Publication introuvable.</Muted>
      </View>
    );
  }
  if (!post) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  const mine = me?.username === post.author.username;
  // iOS : padding = hauteur du clavier pour coller le composer dessus. Android redimensionne déjà la fenêtre.
  const composerPad = Platform.OS === 'ios' && keyboard > 0 ? keyboard : Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {comments.map((comment) => (
          <View key={comment.id} style={{ gap: 4 }}>
            <Text>
              <Text style={{ fontWeight: '700' }}>{comment.username} </Text>
              {comment.body}
            </Text>
            {me?.username === comment.username || mine ? (
              <Pressable onPress={() => void removeComment(comment.id)}>
                <Text style={{ color: colors.danger }}>Effacer</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {comments.length === 0 ? <Muted>Aucun commentaire.</Muted> : null}
        {comments.length < post.comments_count ? <Button label="Commentaires suivants" onPress={() => void moreComments()} /> : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: composerPad,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.bg,
        }}
      >
        <Field value={body} onChangeText={setBody} placeholder="Commentaire" multiline autoCapitalize="sentences" />
        <Button label="Envoyer" onPress={() => void sendComment()} />
      </View>
    </View>
  );
}
