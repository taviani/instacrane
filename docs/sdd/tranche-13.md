# Tranche 13 — publication dans le fil

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Le fil montre chaque publication en entier. Ni le fil ni la grille n’ouvrent un écran de publication. Publier ramène au fil.
- Un glissement horizontal passe à la photo suivante. Un pincement zoome. Un double-appui montre un cœur sur la photo et pose le like. Un second double-appui le laisse. Un glissement vertical sur la photo fait défiler le fil.
- Sous la photo : le nombre de likes, un cœur transparent qui devient rouge, une bulle avec le nombre de commentaires, la légende avec le nom de l’auteur, l’aperçu du commentaire le plus ancien, la durée relative. Ni le mot j’aime, ni le mot commentaire. Pas de champ pour commenter sous la photo.
- Un appui sur le cœur pose le like, un second le retire.
- Trois points : l’auteur efface, les autres signalent. La confirmation reste.
- La bulle ouvre la page des commentaires, du plus ancien au plus récent, avec le champ d’envoi en bas. On y efface un commentaire qu’on a écrit, ou un reçu sur sa publication, sans confirmation.
- Une notification liée à une publication ouvre cette page.
- Le fil porte l’aperçu : auteur et texte du commentaire le plus ancien. `GET /api/posts/{id}` reste pour le lien signé et pour cette page.
- `go test` passe.

## Où

```
server/internal/http/posts_read.go
server/internal/http/posts_test.go
client/src/types.ts
client/src/images.tsx
client/src/grid.tsx
client/src/app/_layout.tsx
client/src/app/(tabs)/feed.tsx
client/src/app/(tabs)/publish.tsx
client/src/app/(tabs)/bell.tsx
client/src/app/post/[id].tsx
```

`client/src/app/post/[id].tsx` devient la page des commentaires. L’écran de détail part.

## On ne fait pas

La page de ceux qui ont aimé. Chercher dans les commentaires. La messagerie. La recherche dans la bio ou la légende. L’export. Réécrire les plans des tranches 1 à 10.
