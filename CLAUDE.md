# Instacrane

Comptes privés, photos, fil chronologique. Pas de mot de passe dans l’application : la session vient de l’issuer. Pas de cookies.

## Stack

- **Client** : une app Expo, les mêmes écrans sur iOS, Android et le web
- **API** : Go, Postgres 16
- **Images** : bucket privé Scaleway, classe standard multi-zones, en France
- **Hébergement** : l’API et l’export web tournent sur l’hôte déjà choisi, port 8000
- **Infra** : Terraform du bucket seul

## Conventions

- Commits en français, format conventionnel (`feat:`, `fix:`, `docs:`)
- Toute PR doit passer les tests

## Structure

```
client/    app Expo
server/    API Go et image
infra/     bucket Scaleway
```

## Commandes

```bash
docker compose up -d
cd server && go test ./...
cd client && npm install && npx expo start --web
```

Les images de test passent par MinIO, lancé à part. La configuration locale n’est pas dans le dépôt.
