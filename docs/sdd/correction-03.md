# Correction 3 — le nom d’utilisateur a au moins 2 caractères

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

Le nom se choisissait entre 3 et 30 caractères. Le minimum passe à 2. Le maximum, les caractères permis, l’unicité et les noms réservés `me` et `search` restent.

## Fait quand

- Un nom de 2 caractères valides est accepté.
- Un nom d’un seul caractère est refusé.
- L’écran de choix dit 2 à 30.

## Où

```
docs/sdd/spec.md
client/src/app/username.tsx
server/internal/http/users.go
server/migrations/004_username_min.sql
```

## On ne fait pas

Changer le maximum, les caractères permis, ni les noms réservés. Réécrire le plan de la tranche 2.
