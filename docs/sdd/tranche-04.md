# Tranche 4 — publications

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- `POST /api/posts` publie une à vingt photos, dans l’ordre envoyé, avec une légende facultative. Sans nom d’utilisateur, c’est refusé.
- Chaque photo est stockée deux fois : affichage, grand côté 1440 pixels, et miniature, grand côté 480. Pas d’agrandissement. L’original est oublié. Le fichier enregistré n’a pas de métadonnées, donc pas de position.
- La localisation est facultative. Absente, rien n’est gardé. Présente, une seule position est enregistrée sur la publication, jamais sur le profil. Elle part avec la publication.
- Le fil est une seule suite chronologique. L’ordre est l’heure d’enregistrement de la publication, la plus récente d’abord, que l’auteur soit soi ou un compte dont la demande a été acceptée. La page suivante charge les plus anciennes. Une demande acceptée ouvre tout l’historique : la grille du profil et le fil. Une demande en attente n’y met rien. Le sens inverse reste fermé.
- Le détail montre les photos d’affichage, dans l’ordre, la légende, la position s’il y en a une, et les nombres de likes et de commentaires. On n’y arrive que si on peut voir la publication.
- Supprimer une publication retire ses photos, ses likes et ses commentaires. Seul l’auteur le peut.
- Aimer et retirer son like. Commenter. Effacer un commentaire qu’on a écrit, ou un commentaire reçu sur sa publication. Aimer ou commenter exige de pouvoir voir la publication. Commenter exige un nom d’utilisateur.
- Chaque image visible est un lien de quelques minutes. La base garde les clés. Les clés ne sortent pas dans les réponses. La grille du profil reçoit le lien de la première miniature, plus le nombre de photos.
- `DELETE /api/users/me` retire l’avatar, les publications et toutes leurs photos, puis le profil. Il ne reste pas de ligne rattachée à ce `sub`.
- Tout appel sauf `GET /api/health` exige une session valide. Les requêtes vers la base restent paramétrées. Les entrées sont validées avant l’écriture.
- `go test` passe, avec l’issuer de test et MinIO.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Fil

Virginie a fait accepter sa demande par Paul. Le fil de Virginie mêle ses publications et celles de Paul, la plus récente d’abord. Paul publie à 10 h, Virginie à 11 h : dans le fil de Virginie, la sienne est au-dessus. L’heure est celle enregistrée par l’API à la publication, pas une heure lue dans la photo. Le fil de Paul contient les siennes, pas celles de Virginie. Pour ça, Paul doit envoyer sa propre demande, et Virginie l’accepte. Chaque fil reste trié de la même façon.

L’acceptation ouvre aussi l’historique. Les publications de Paul d’avant la demande apparaissent sur sa grille, la plus récente d’abord, et dans le fil de Virginie à leur heure. Rien n’est limité à ce que Paul publie après avoir accepté.

Tant que Paul n’a pas accepté, Virginie ne voit pas ses publications : ni dans le fil, ni sur son profil, ni par l’identifiant. Une publication qu’on ne peut pas voir répond comme si elle n’existait pas. Aimer ou commenter celle-là est refusé de la même façon.

Au départ, avant toute demande, le fil ne contient que ses propres publications.

## Publication

Le bouton de localisation est l’affaire de l’app. L’API ne lit pas la position dans le fichier. Elle reçoit, ou non, une paire de coordonnées choisie par l’auteur. S’il n’en envoie pas, la publication n’en a pas. S’il en envoie, c’est cette position qui est montrée à ceux qui peuvent voir la publication. Il n’y a pas de deuxième position, ni de trace de la source. Rien n’est copié sur le profil.

L’auteur peut recadrer chaque photo dans l’app, avant l’envoi. Ce geste est le client, pas cette tranche : l’API ne reçoit que l’image déjà cadrée. Elle ne propose pas de recadrage. L’app réduit aussi la photo et la dépouille avant l’envoi. Si le fichier reçu est plus grand, l’API le réduit à 1440 et oublie l’original. Elle réencode aussi quand le fichier est déjà à la bonne taille, pour qu’aucune métadonnée ne reste. Une position qui serait encore dans le fichier est donc perdue. Seule la paire envoyée à part est gardée.

Supprimer la publication efface les deux fichiers de chaque photo. Supprimer le compte efface d’abord ces fichiers et l’avatar, puis la ligne du profil. Si le stockage ne retire pas les fichiers, le profil reste, pour qu’un nouvel appel puisse finir. La confirmation est demandée par l’app, plus tard : ici, l’appel authentifié suffit.

La légende reste un champ de la publication. Le détail la renvoie à part des commentaires, pour que le client l’affiche comme le premier commentaire, avec le nom de l’auteur. Elle n’est pas une ligne de commentaire, et le nombre de commentaires ne la compte pas. Vide, elle n’affiche rien.

Un like ou un commentaire sur son propre contenu est permis. Il ne crée pas de notification. Aucune notification n’est écrite dans cette tranche.

## Où

On étend `server/`. Une migration ajoute la position sur la publication : deux nombres, tous les deux présents, ou aucun. La légende et le texte d’un commentaire ont une longueur maximale, répétée par la base.

```
server/
  internal/media/      réduit l’affichage et la miniature
  internal/http/       publication, fil, like, commentaire, suppression du compte
  migrations/          position, longueurs
```

Le stockage d’objets est déjà celui de la tranche 3. Les tests et la CI lancent MinIO, puis `go test`. Le fichier compose ne change pas.

## Images

JPEG, PNG ou WebP en entrée. Le reste est refusé. Une image de plus de 8000 pixels de côté est refusée. Chaque fichier est limité, et il en faut entre un et vingt.

Ce qui est stocké est du JPEG, sans métadonnées. Affichage : grand côté au plus 1440. Miniature : grand côté au plus 480. Les clés sont tirées au hasard, sous un préfixe fixe. L’API ne supprime que des clés de ce préfixe, ou du préfixe des avatars.

Le lien signé dure quelques minutes, comme l’avatar. Le fil et le détail signent les photos d’affichage. La grille signe la miniature de la première. `GET /api/users/{username}/posts` ne renvoie plus la clé d’objet.

## Routes

Toutes exigent une session.

- `POST /api/posts` : une à vingt photos, dans l’ordre, légende facultative, position facultative. Les deux coordonnées vont ensemble. Rien d’autre. Sans nom d’utilisateur, refus.
- `GET /api/posts/feed` : une seule suite, ses publications et celles des comptes suivis avec une demande acceptée, triée par l’heure d’enregistrement, la plus récente d’abord. Les pages suivantes prennent les plus anciennes.
- `GET /api/posts/{id}` : détail si on peut la voir, sinon introuvable. Photos d’affichage dans l’ordre, légende, position ou rien, nombres de likes et de commentaires, commentaires du plus ancien au plus récent.
- `DELETE /api/posts/{id}` : l’auteur retire la publication et ses fichiers. Les autres la trouvent introuvable.
- `POST /api/posts/{id}/like` et `DELETE /api/posts/{id}/like` : pose ou retire son like. Un second like ne crée pas une seconde ligne. Sans pouvoir voir la publication, c’est introuvable.
- `GET` et `POST /api/posts/{id}/comments` : lire ou écrire. Le texte vide est refusé. Sans nom d’utilisateur, écrire est refusé.
- `DELETE /api/posts/{id}/comments/{comment_id}` : l’auteur du commentaire, ou l’auteur de la publication. Les autres le trouvent introuvable.
- `GET /api/users/{username}/posts` : toute la grille si la demande est acceptée, ou si c’est nous, y compris les publications d’avant l’acceptation. Sinon une liste vide. Le compte inconnu reste introuvable. La miniature de la première photo est un lien signé.
- `DELETE /api/users/me` : retire les fichiers, puis le profil. Les follows, likes, commentaires, publications, notifications, jeton, blocages et signalements rattachés partent avec la ligne.

La légende est limitée à 2200 caractères. Un commentaire est limité à 1000. Une page de fil ou de grille charge 12 publications, 30 au plus. Une page de commentaires en charge 30, 50 au plus.

## On ne fait pas

Notification, cloche, alerte téléphone, signalement, blocage, explore, compteur de vues, recommandation, client, Renovate. L’API ne lit pas la position dans la photo, et n’en met pas sur le profil. Le bouton de localisation, le recadrage, l’affichage de la légende, le carrousel et le cache de l’image arrivent avec le client.
