import { useEffect, useState } from 'react';
import { Screen, Column, Logo, Title, Muted, ErrorText, Button } from '../ui';
import { authConfigured } from '../config';
import { message } from '../api';
import { prepareLogin, takeLoginError } from '../auth';
import { useSession } from '../session';

export default function LoginScreen() {
  const { login } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const ready = authConfigured();

  useEffect(() => {
    const pendingError = takeLoginError();
    if (pendingError) setError(pendingError);
    let alive = true;
    void prepareLogin()
      .then(() => {
        if (alive) setCanPrompt(true);
      })
      .catch((cause) => {
        if (alive) setError(message(cause));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen center>
      <Column>
        <Logo />
        <Title>Instacrane</Title>
        {ready ? null : (
          <Muted>
            La connexion a besoin de l’adresse de l’issuer et de l’identifiant de client. Sans adresse d’API, les appels restent sur le même site.
          </Muted>
        )}
        <ErrorText>{error}</ErrorText>
        <Button
          block
          label={busy ? 'Connexion…' : 'Se connecter'}
          disabled={!ready || busy || !canPrompt}
          onPress={() => {
          setBusy(true);
          setCanPrompt(false);
          setError(null);
          void login()
            .catch((cause) => setError(message(cause)))
            .finally(() => {
              setBusy(false);
              void prepareLogin()
                .then(() => setCanPrompt(true))
                .catch((cause) => setError(message(cause)));
            });
          }}
        />
      </Column>
    </Screen>
  );
}
