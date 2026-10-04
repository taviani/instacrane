# Tranche 2 — auth

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- `GET /api/health` répond toujours sans session.
- Tout autre appel sans session valide est refusé.
- Le premier `GET /api/users/me` crée le profil à partir du `sub`, et recopie l’email quand la session en fournit un.
- Un appel suivant met à jour l’email si la session en fournit un, et le laisse en place sinon.
- `PATCH /api/users/me` pose le nom d’utilisateur une seule fois, selon la règle de la spec.
- Publier, commenter ou suivre est refusé tant que ce nom est vide. Ces trois routes n’existent pas encore : la tranche teste le refus, elle ne les ajoute pas.
- `go test` passe, avec un issuer de test.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Où

On étend `server/`. Pas de nouvelle migration : le schéma de la tranche 1 a déjà le `sub`, l’email et le nom d’utilisateur.

```
server/
  internal/config/     ajoute l’adresse de l’issuer
  internal/auth/       vérifie la session, en tire le sub et l’email
  internal/http/       GET et PATCH /api/users/me
```

## Configuration

L’adresse de l’issuer vient de l’environnement. Aucune valeur n’est écrite dans le dépôt. Les tests lancent eux-mêmes un issuer de test. La CI reste celle de la tranche 1 : Postgres, puis `go test`.

L’API ne crée pas de session. Elle vérifie celle de l’issuer.

## Routes

- `GET /api/health` : inchangé, sans session.
- `GET /api/users/me` : exige une session. Crée le profil s’il manque. Répond avec les champs du profil. L’email n’est renvoyé qu’ici, au titulaire.
- `PATCH /api/users/me` : exige une session. Cette tranche n’accepte que `username`.

Le nom suit `^[a-zA-Z0-9_.]+$`, de 3 à 30 caractères, unique. Un nom invalide, déjà pris, ou un second changement est refusé. `GET /api/users/me` reste autorisé tant que le nom est vide.

## On ne fait pas

Nom affiché, bio, avatar, suivi, recherche, photos, notifications, signalement, client. Pas de Renovate dans cette tranche. Pas de route d’inscription ni de connexion locale.
