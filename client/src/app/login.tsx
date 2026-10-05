import { useState } from 'react';
import { Screen, Title, Muted, ErrorText, Button } from '../ui';
import { authConfigured } from '../config';
import { message } from '../api';
import { useSession } from '../session';

export default function LoginScreen() {
  const { login } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = authConfigured();

  return (
    <Screen>
      <Title>Instacrane</Title>
      {ready ? (
        <Muted>La session vient de l’issuer. L’application ne choisit pas de mot de passe.</Muted>
      ) : (
        <Muted>
          La connexion a besoin d’une configuration locale : l’adresse de l’API, l’adresse de l’issuer et l’identifiant de client.
        </Muted>
      )}
      <ErrorText>{error}</ErrorText>
      <Button
        label={busy ? 'Connexion…' : 'Se connecter'}
        disabled={!ready || busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void login()
            .catch((cause) => setError(message(cause)))
            .finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}
