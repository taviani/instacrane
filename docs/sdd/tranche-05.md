# Tranche 5 — notifications

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Un like crée une notification pour l’auteur de la publication. Un commentaire aussi. Une demande de suivi en crée une pour la personne qui doit accepter ou refuser.
- Agir sur son propre contenu ne crée rien. Se suivre soi-même non plus, et c’est déjà refusé. Un like qui ne crée pas de nouvelle ligne n’ajoute pas une seconde notification.
- `GET /api/notifications` montre les siennes, la plus récente d’abord. On y voit le type, l’auteur de l’action, la date, et la publication s’il y en a une. Pas l’email, pas le texte du commentaire, pas la légende.
- La réponse dit si la cloche doit être marquée : une notification non lue, ou une demande de suivi encore en attente. `POST /api/notifications/read` marque les notifications comme lues. Une demande en attente laisse la cloche marquée.
- Le jeton d’alerte n’est gardé que si la personne l’enregistre. Le retirer l’efface. Sans jeton, aucune alerte n’est préparée. Avec un jeton, le texte dit qui a agi et de quelle façon, rien d’autre.
- `DELETE /api/users/me` retire les notifications et le jeton avec le profil, comme les clés étrangères le prévoient déjà.
- Tout appel sauf `GET /api/health` exige une session valide. Les requêtes vers la base restent paramétrées. Les entrées sont validées avant l’écriture.
- `go test` passe, avec l’issuer de test. Les tests qui attendaient zéro notification sont mis à jour.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Les trois cas

Virginie envoie une demande à Paul. Paul reçoit une notification de demande. Tant qu’il n’a pas accepté ou refusé, la cloche reste marquée, même s’il a marqué ses notifications comme lues. Accepter ouvre les photos de Paul à Virginie. Ça n’ouvre pas celles de Virginie, et ça ne crée pas une notification pour elle.

Paul accepte. Virginie aime une publication de Paul : Paul est prévenu. Elle la commente : il est prévenu encore. Paul aime ou commente sa propre publication : rien. Un second like de Virginie, alors que le premier est toujours là, ne crée pas une deuxième notification.

Refuser ou annuler la demande ne prévient personne d’autre. Se désabonner non plus.

## Alerte

La cloche est dessinée par le client, plus tard. Ici, l’API dit seulement si elle doit être marquée.

L’alerte sur le téléphone part du même principe. Le jeton est enregistré par l’app quand la personne accepte, et retiré quand elle retire cette acceptation, ou quand elle quitte la session. Un seul jeton par compte : le nouveau remplace l’ancien. Le texte ne contient pas l’email, ni le commentaire, ni la légende.

L’envoi réel vers le service du téléphone attend une configuration locale. Aucune adresse et aucun secret ne sont écrits dans le dépôt. Si cette configuration manque, l’action réussit quand même : la notification est en base, l’alerte n’est pas envoyée. Les tests vérifient la décision d’envoyer, pas un service externe.

## Où

On étend `server/`. Les tables `notifications` et `push_tokens` existent déjà. Pas de migration, sauf si un essai montre qu’une contrainte manque.

```
server/
  internal/http/    création au like, au commentaire et à la demande
                    liste, marque lu, jeton d’alerte
```

## Routes

Toutes exigent une session.

- `GET /api/notifications` : ses notifications, la plus récente d’abord. Chaque page en charge 20, 50 au plus. La réponse comprend aussi l’état de la cloche.
- `POST /api/notifications/read` : marque comme lues les notifications de ce compte. Rien d’autre.
- `PUT /api/users/me/alert-token` : enregistre le jeton. Un corps vide, un jeton vide, ou un champ en trop est refusé. Le jeton est limité en longueur.
- `DELETE /api/users/me/alert-token` : retire le jeton. S’il n’y en a pas, l’appel reste réussi.

La création se fait dans les routes déjà là : like, commentaire, demande de suivi. Accepter, refuser, annuler, se désabonner, retirer un like ou effacer un commentaire ne créent pas une notification.

## On ne fait pas

La cloche dessinée, l’écran des notifications, l’envoi réel vers le téléphone, le signalement, le blocage, le compteur de vues, la recommandation, le client, Renovate.
