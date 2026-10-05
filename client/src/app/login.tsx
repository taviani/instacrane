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
          La connexion a besoin de l’adresse de l’issuer et de l’identifiant de client. Sans adresse d’API, les appels restent sur le même site.
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
