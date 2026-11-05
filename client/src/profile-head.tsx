import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { avatarKey } from './cache';
import { CachedImage } from './images';
import { profileDisplayLine, profileTitle } from './profile-name';
import type { Profile } from './types';
import { Muted, Title } from './ui';

export function ProfileHead({ card }: { card: Profile }) {
  const router = useRouter();
  const display = profileDisplayLine(card.username, card.display_name);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <CachedImage name={avatarKey(card.username, card.avatar_url)} url={card.avatar_url} style={{ width: 86, height: 86, borderRadius: 43 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Title>{profileTitle(card.username, card.display_name)}</Title>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Count value={card.posts_count} one="publication" many="publications" />
          <Count
            value={card.followers_count}
            one="abonné"
            many="abonnés"
            onPress={() => router.push(`/followers/${card.username}`)}
          />
          <Count
            value={card.following_count}
            one="abonnement"
            many="abonnements"
            onPress={() => router.push(`/following/${card.username}`)}
          />
          </View>
        </View>
      </View>
      {display ? <Text>{display}</Text> : null}
      {card.bio ? <Muted>{card.bio}</Muted> : null}
    </View>
  );
}

function Count({
  value,
  one,
  many,
  onPress,
}: {
  value: number;
  one: string;
  many: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={{ alignItems: 'flex-start', gap: 2 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>{value}</Text>
      <Text>{value === 1 ? one : many}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}
