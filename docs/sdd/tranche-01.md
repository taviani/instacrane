# Tranche 1 — socle

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Les migrations créent le schéma décrit dans la spec, sur une base vide.
- `GET /api/health` répond sans session.
- `go test` passe.
- La CI lance ces tests à chaque changement de `server/`.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Où

Le module Go vit dans `server/`, à côté du Python. Pas dans `backend/` : ce dossier déclenche encore la CI Python.

```
server/
  cmd/server/          le binaire, écoute sur le port 8000
  internal/config/     lit l’environnement
  internal/db/         connexion et migrations
  internal/http/       GET /api/health
  migrations/          SQL versionné
```

## Configuration

`DATABASE_URL` vient de l’environnement. Aucune valeur n’est écrite dans le dépôt. Les tests et la CI utilisent la base Postgres déjà lancée par `docker compose`.

## Schéma

Une migration, les tables de la spec, et rien d’autre.

- `users` : clé `sub`, email, nom d’utilisateur unique et nul tant qu’il n’est pas choisi, nom affiché, bio, clé d’avatar, date de création.
- `follows` : qui suit qui, couple unique.
- `posts` : auteur, légende, date.
- `post_photos` : publication, ordre, clé d’affichage, clé de miniature.
- `comments` : auteur, publication, texte, date.
- `likes` : couple utilisateur et publication, unique.
- `notifications` : destinataire, auteur de l’action, type, publication s’il y en a une, date, lu ou non.
- `push_tokens` : un jeton d’alerte par utilisateur.
- `blocks` : couple unique.
- `reports` : qui signale, la cible (compte ou publication), date.

Les fichiers ne sont pas dans la base, seulement leurs clés. Pas de mot de passe, pas d’adresse de fournisseur.

## Routes

Seule route : `GET /api/health`. Les autres attendent les tranches suivantes. Pas de vérification de session dans cette tranche : il n’y a pas encore d’autre route.

## CI

Un workflow ne s’occupe que de `server/`. Il lance Postgres, applique les migrations, exécute `go test`. Le workflow Python reste en place.

## On ne fait pas

Auth, profils, photos, client, bucket, modification de `docker compose`, suppression du Python ou du SvelteKit.
