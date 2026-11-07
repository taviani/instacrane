# Correction 7 — la page d’une publication

Plan. Le produit reste celui de `spec.md`. Ce n’est pas une nouvelle tranche.

Les trois points proposent d’ouvrir la publication, de copier son lien, ou de le partager. La page a une flèche de retour en haut à gauche. Un appui sur une case de la grille ouvre cette page ; le retour retrouve la grille à l’endroit où l’on était. Le fil et la suite du profil ne l’ouvrent pas d’eux-mêmes.

## Fait quand

- Tout le monde voit ces trois choix. L’auteur garde modifier et supprimer. Les autres gardent signaler, avec confirmation.
- La page montre la publication comme dans le fil. La flèche revient en arrière, ou au fil si la page a été ouverte par le lien.
- Copier met l’adresse https du site dans le presse-papiers. Partager ouvre le menu du système avec la même adresse.
- Sur un téléphone dans le navigateur, une bannière reste visible sur tout le site : ouvrir l’app (sur la page courante) ou l’installer (si l’adresse du store est configurée).
- Sans session, le lien mène à la connexion, puis à cette publication. Une publication invisible reste introuvable.
- L’origine du site et les adresses de store viennent de la configuration locale / des secrets, pas du dépôt.

## Où

```
client/src/permalink.ts
client/src/post-card.tsx
client/src/grid.tsx
client/src/profile-scroll.ts
client/src/app-invite.ts
client/src/open-app-banner.tsx
client/src/app/publication/[id].tsx
client/src/app/_layout.tsx
client/src/config.ts
```

## On ne fait pas

Ouvrir cette page en appuyant sur la photo du fil. Rendre une publication visible sans session. Les Universal Links Apple/Google. Réécrire le plan de la tranche 13.
