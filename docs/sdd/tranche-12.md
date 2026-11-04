# Tranche 12 — roue crantée

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Son profil a la même disposition que la fiche. Cette page n’est plus un formulaire.
- En haut à gauche de son profil, la roue crantée ouvre : modifier le profil, demandes reçues, alertes, données, quitter la session.
- Modifier le profil change le nom affiché, la bio et l’avatar.
- Le profil d’un autre n’a pas cette roue. Suivre, bloquer et signaler restent sur sa fiche.
- La grue reste le retour au fil. Le plus et la cloche restent en haut à droite. La barre du bas reste la recherche et le profil.

## Où

```
client/src/app/(tabs)/_layout.tsx
client/src/app/(tabs)/profile.tsx
client/src/app/user/[username].tsx
```

L’écran modifier le profil s’ajoute sous `client/src/app/`.

## On ne fait pas

L’archive. Une entrée accueil dans la barre du bas. Le fil, la page de ceux qui ont aimé, la recherche, l’export. Réécrire les plans des tranches 1 à 10.
