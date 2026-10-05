import { Redirect } from 'expo-router';
import { useSession } from '../session';

export default function Index() {
  const { ready, token, me } = useSession();
  if (!ready) return null;
  if (!token) return <Redirect href="/login" />;
  if (!me?.username) return <Redirect href="/username" />;
  return <Redirect href="/(tabs)/feed" />;
}
