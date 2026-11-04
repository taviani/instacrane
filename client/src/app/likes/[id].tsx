import { useLocalSearchParams } from 'expo-router';
import { PeopleList } from '../../people';

export default function LikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <PeopleList path={`/api/posts/${id}/likes`} />;
}
