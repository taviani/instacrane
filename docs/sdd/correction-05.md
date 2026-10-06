# Correction 5 — le retour de connexion quitte `/redirect`

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

Sur le web, le retour arrive sur `/redirect` avec le code. L’écran reste vide, le code reste dans l’adresse, et l’app n’ouvre pas le fil quand le nom est déjà choisi. Si le vérificateur n’est plus là, rien n’est dit.

L’issuer ne change pas. Pour une adresse `https`, il redirige déjà vers `/redirect`. Ce contrat (retour `302`, code échangé une seule fois) est prouvé par un test de l’issuer, une fois pour tous les clients. On ne le recopie pas ici.

## Fait quand

- Avant de partir, le vérificateur et l’état sont gardés dans le navigateur, pour le retour dans le même onglet.
- `/redirect` échange le code une seule fois, enlève le code et l’état de l’adresse, puis ouvre le fil, ou l’écran du nom s’il manque.
- Pendant l’échange, l’écran montre l’attente.
- Si le vérificateur manque ou si l’échange échoue, retour à la connexion avec la raison.

## Où

```
client/src/login-return.ts
client/src/login-return.test.ts
client/src/auth.ts
client/src/app/redirect.tsx
client/src/app/_layout.tsx
```

## On ne fait pas

Modifier l’issuer. Introduire un cookie. Changer le retour du schéma natif. Réécrire le plan de la tranche 7.
