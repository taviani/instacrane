# Tranche 8 — bascule

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Une image remplace le backend Python. Elle contient le binaire Go et l’export web Expo. Elle écoute sur le port 8000. L’API reste sous `/api`. Le reste sert le site : un fichier qui existe est renvoyé, sinon la page de l’export, pour que les adresses de l’app s’ouvrent. Même origine, donc le site n’a pas besoin d’une origine supplémentaire.
- La CI teste `server/`, construit l’export web, et construit l’image. Elle ne la pousse nulle part.
- `backend/` et `frontend/` sortent du dépôt, avec leur CI et leurs déploiements. `CLAUDE.md` et l’exemple d’environnement à la racine décrivent le Go et l’app Expo. L’exemple ne contient aucune valeur.
- `infra/` ne décrit plus que le bucket privé, classe standard, multi-zones. Pas d’API, pas de base, pas de site, pas de registre. Aucun nom d’hôte, aucun identifiant de projet, aucune clé. `terraform validate` passe dans la CI.
- `docker compose` ne lance plus que Postgres. Les images de test passent par MinIO, lancé à part, comme aujourd’hui.
- L’API et le site restent sur l’hôte déjà choisi. Rien dans le dépôt ne nomme cet hôte, ni un registre, ni un compte.

## Où

```
server/Dockerfile     l’image, binaire Go et export web
infra/                le bucket seul
client/               inchangé dans son comportement
```

L’export est produit au moment de construire l’image. Il n’est pas versionné.

## On ne fait pas

Copier l’image sur l’hôte. Appliquer le Terraform : ça attend le compte Scaleway, à la main. Créer le client chez l’issuer, ni remplir les fichiers d’environnement. Les builds de stores, la soumission, l’envoi réel des alertes, le compteur de vues, la recommandation, la remontée d’un signalement vers l’issuer, Renovate.
