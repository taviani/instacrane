import { useLocalSearchParams } from 'expo-router';
import { PeopleList } from '../../people';

export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  if (!username) return null;
  return <PeopleList path={`/api/users/${encodeURIComponent(username)}/following`} />;
}
