# Tranche 14 — qui a aimé

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Un appui sur le nombre devant le cœur ouvre la page des personnes qui ont aimé, la plus récente d’abord.
- Le nombre compte tous les likes. La page montre ceux qui ont un nom d’utilisateur. Ce nom ouvre la fiche.
- `likes` gagne `created_at`.
- `GET /api/posts/{id}/likes` ne répond que si la publication est visible. Sinon elle est introuvable.
- `go test` passe.

## Où

```
server/migrations/005_like_time.sql
server/internal/http/posts_read.go
server/internal/http/posts_test.go
client/src/app/(tabs)/feed.tsx
```

La page s’ajoute sous `client/src/app/`.

## On ne fait pas

La recherche dans la bio ou la légende. Chercher dans les commentaires. La messagerie. L’export. Réécrire les plans des tranches 1 à 10.
