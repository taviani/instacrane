# Correction 4 — cloche et publier en haut à droite

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

La barre du bas montrait cinq entrées, avec le même signe à la place des icônes. La cloche et publier passent en haut à droite. La grue, en haut à gauche, ouvre le fil. Le bas garde la recherche et le profil. Le bandeau reste visible quand les publications défilent.

## Fait quand

- En haut à gauche, la grue ramène au fil. Le bandeau reste visible au défilement des publications.
- En haut à droite, une cloche ouvre les notifications, un signe plus ouvre la publication.
- La barre du bas a deux entrées : une loupe et un avatar.
- Sur le profil, le nom et l’avatar ouvrent la fiche que les autres voient.
- Sur le profil et sur la fiche, les compteurs d’abonnés et d’abonnements sont à droite de l’avatar et ouvrent les listes.
- L’écran de connexion montre la grue, au centre.
- Quitter la session, effacer, bloquer, signaler et supprimer le compte ouvrent une confirmation.
- Aucun fond d’écran n’est gris. Le thème de navigation est blanc, comme l’avatar vide.
- Publier et la cloche ne sont plus dans cette barre.

## Où

```
client/src/icons.tsx
client/src/ui.tsx
client/src/images.tsx
client/src/auth.ts
client/src/app/login.tsx
client/src/app/_layout.tsx
client/src/app/(tabs)/_layout.tsx
client/src/app/(tabs)/feed.tsx
client/src/app/(tabs)/profile.tsx
client/src/app/user/[username].tsx
client/assets/logo.png
```

## On ne fait pas

Ajouter une bibliothèque d’interface. Réécrire le plan de la tranche 7. L’export des données.
