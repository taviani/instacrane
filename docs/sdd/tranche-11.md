# Tranche 11 — tête du profil

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- `GET /api/users/{username}` renvoie `posts_count` : le nombre de publications, pas le nombre de photos.
- Ce nombre est visible avant l’acceptation, avec le nom, l’avatar et la bio. Les photos restent cachées.
- Sur le profil et sur la fiche, le nom d’utilisateur est au-dessus des compteurs, à droite de l’avatar.
- À droite de l’avatar, trois compteurs : publications, abonnés, abonnements. Le premier n’ouvre pas de liste. Les deux autres ouvrent les listes.
- Le nom affiché et la bio restent en dessous.
- `go test` passe.

## Où

```
server/internal/http/profile.go
server/internal/http/profiles_test.go
client/src/types.ts
client/src/app/(tabs)/profile.tsx
client/src/app/user/[username].tsx
```

## On ne fait pas

La roue crantée, le fil, la page de ceux qui ont aimé, la recherche dans la bio ou la légende, l’export. Réécrire les plans des tranches 1 à 10.
