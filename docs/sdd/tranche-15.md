# Tranche 15 — recherche

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- `GET /api/users/search/{query}` trouve un compte par son nom d’utilisateur, son nom affiché ou sa bio.
- La même recherche trouve une publication par sa légende, seulement quand on peut la voir.
- Un compte ouvre sa fiche. Une publication s’affiche comme dans le fil.
- Les commentaires ne sont pas cherchés.
- `go test` passe.

## Où

```
server/internal/http/profile.go
server/internal/http/profiles_test.go
server/internal/http/posts_read.go
client/src/app/(tabs)/search.tsx
client/src/app/(tabs)/feed.tsx
```

## On ne fait pas

Chercher dans les commentaires. La messagerie. L’archive. L’export. Réécrire les plans des tranches 1 à 10.
