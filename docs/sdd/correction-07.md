# Correction 7 — la page d’une publication

Plan. Le produit reste celui de `spec.md`. Ce n’est pas une nouvelle tranche.

Les trois points proposent d’ouvrir la publication, de copier son lien, ou de le partager. La page a une flèche de retour en haut à gauche. Le fil, la grille et la suite du profil n’ouvrent pas cette page d’eux-mêmes.

## Fait quand

- Tout le monde voit ces trois choix. L’auteur garde modifier et supprimer. Les autres gardent signaler, avec confirmation.
- La page montre la publication comme dans le fil. La flèche revient en arrière, ou au fil si la page a été ouverte par le lien.
- Copier met l’adresse dans le presse-papiers. Partager ouvre le menu du système.
- Sur le site, l’adresse est celle du site. Sur le téléphone, elle rouvre l’application sur cette publication.
- Sans session, le lien mène à la connexion, puis à cette publication. Une publication invisible reste introuvable.

## Où

```
client/src/permalink.ts
client/src/post-card.tsx
client/src/app/publication/[id].tsx
client/src/app/_layout.tsx
```

## On ne fait pas

Ouvrir cette page en appuyant sur la photo du fil. Rendre une publication visible sans session. Réécrire le plan de la tranche 13.
