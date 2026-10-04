# Tranche 3 — profils

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- `PATCH /api/users/me` corrige le nom affiché et la bio, autant de fois qu’on veut. Le nom d’utilisateur reste posé une seule fois. L’email ne se modifie pas ici.
- `POST /api/users/me/avatar` enregistre un avatar : grand côté 512 pixels, sans métadonnées, clé d’objet en base. L’original plus grand est réduit puis oublié. Un fichier qui n’est pas une photo est refusé.
- `GET /api/users/{username}` montre le nom, l’avatar et la bio, plus les deux compteurs. L’email n’y est pas. La fiche dit aussi où en est notre demande : absente, en attente, ou acceptée.
- La recherche trouve un compte par son nom d’utilisateur ou son nom affiché. On voit le nom, l’avatar et la bio. Pas l’email, pas les photos.
- Suivre quelqu’un envoie une demande. Tant qu’elle n’est pas acceptée, ses photos restent cachées. Lui seul accepte ou refuse. Accepter nous ouvre ses photos. Ça ne lui ouvre pas les nôtres : il doit envoyer sa propre demande, et on l’accepte à part.
- Les compteurs et les listes d’abonnés et d’abonnements ne comptent que les demandes acceptées. Les demandes reçues en attente ont leur liste.
- `GET /api/users/{username}/posts` ne renvoie les publications que si notre demande a été acceptée, ou si c’est nous. La plus récente d’abord. Chaque page charge les plus anciennes. La grille reçoit la clé de miniature de la première photo, et le nombre de photos.
- Tout appel sauf `GET /api/health` exige une session valide. Les requêtes vers la base restent paramétrées.
- `go test` passe, avec l’issuer de test et MinIO.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Demande de suivi

Virginie cherche Paul, le trouve, et envoie une demande. Paul voit cette demande. Tant qu’il n’a pas accepté, Virginie ne voit pas les photos de Paul. Paul accepte : Virginie les voit, sur le profil de Paul et, plus tard, dans son fil. Paul ne voit toujours pas les photos de Virginie. Pour ça, Paul envoie une demande à Virginie, et Virginie l’accepte. Ce sont deux demandes. Aucune n’ouvre les deux sens.

Se demander à soi-même est refusé. Sans nom d’utilisateur, envoyer une demande est refusé. Une demande déjà en attente ne se duplique pas. Refuser ou annuler retire la demande, et n’ouvre rien. Se désabonner retire une demande acceptée, et referme les photos.

Seul Paul peut accepter ou refuser la demande que Virginie lui a envoyée. Virginie peut annuler la sienne, ou se désabonner ensuite.

La demande crée une notification pour Paul. Cette notification, et la cloche qui la montre, ne sont pas dans cette tranche : elles arrivent avec les notifications, puis avec le client. La liste des demandes reçues, elle, est ici, pour qu’on puisse déjà accepter ou refuser.

## Où

On étend `server/`. Une migration ajoute l’état du suivi : en attente, ou accepté. Le couple reste unique. Sans acceptation, la ligne ne donne aucun accès aux photos.

```
server/
  internal/config/     ajoute le stockage d’objets
  internal/media/      réduit l’avatar et parle au stockage
  internal/http/       profil, demande, listes, recherche
  migrations/          état du suivi
```

## Configuration

L’adresse du stockage, le nom du conteneur et les clés viennent de l’environnement. Aucune valeur n’est écrite dans le dépôt. Les tests utilisent le MinIO déjà lancé par `docker compose`. La CI du serveur lance aussi MinIO, puis `go test`. Le fichier compose ne change pas.

L’avatar visible est un lien de quelques minutes, signé par l’API. La base garde la clé, pas l’adresse du fournisseur. Les clés de signature ne quittent pas l’API.

## Routes

Toutes exigent une session.

- `PATCH /api/users/me` : accepte `username` (une fois), `display_name`, `bio`. Rien d’autre.
- `POST /api/users/me/avatar` : remplace l’avatar précédent, y compris l’objet stocké.
- `GET /api/users/{username}` : fiche publique, et l’état de notre demande vers ce compte.
- `GET /api/users/search/{query}` : comptes trouvés, avec le même état.
- `POST /api/users/{username}/follow` : envoie la demande. N’ouvre pas les photos.
- `DELETE /api/users/{username}/follow` : annule notre demande, ou retire un suivi accepté.
- `GET /api/users/me/follow-requests` : demandes reçues, encore en attente.
- `POST /api/users/{username}/follow/accept` : on accepte la demande que ce compte nous a envoyée.
- `DELETE /api/users/{username}/follow/request` : on la refuse.
- `GET /api/users/{username}/followers` et `GET /api/users/{username}/following` : uniquement les demandes acceptées.
- `GET /api/users/{username}/posts` : ses publications si la demande est acceptée, les nôtres si c’est nous, sinon une liste vide. Le compte inconnu reste introuvable.

`GET /api/users/me` continue de renvoyer l’email au seul titulaire.

## On ne fait pas

Fil, envoi d’une publication, likes, commentaires, lien signé des photos de publication, création de la notification, cloche, signalement, blocage, suppression de compte, client. Pas de Renovate dans cette tranche. La notification de la demande est prévue à la tranche 5, la cloche au client.
