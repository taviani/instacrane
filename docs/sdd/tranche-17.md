# Tranche 17 — alertes

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- iOS, Android et le web peuvent chacun accepter les alertes. Le bouton des réglages demande l’autorisation du système. Un refus n’enregistre aucun jeton.
- Chaque appareil garde son jeton, avec son genre. Le même appareil qui en enregistre un nouveau remplace le sien. Les autres appareils du compte restent.
- Quitter la session, ou retirer l’acceptation, retire le jeton de cet appareil. Supprimer le compte retire tous les jetons.
- iOS part vers le service d’Apple, Android vers celui de Google, le web vers le navigateur. Un jeton ne sert pas à un autre genre.
- Le texte est celui de la cloche. L’alerte ouvre les commentaires s’il y a une publication, sinon les demandes reçues. Rien si l’app est au premier plan, ni si l’onglet du site est ouvert.
- Sur iPhone, un onglet Safari ne reçoit rien. Le site ajouté à l’écran d’accueil le peut. Le service worker n’est enregistré qu’à l’acceptation.
- Sans la configuration du genre, ou si l’envoi échoue, l’action reste réussie et la notification reste en base. Un jeton périmé est retiré.
- `go test` passe. Les tests vérifient le genre, le destinataire et le texte, pas un service externe.

## Où

```
server/migrations/
server/internal/http/notify.go
server/internal/http/notify_test.go
client/src/app/settings.tsx
```

Le service worker du site s’ajoute sous `client/`.

## On ne fait pas

De nouveaux cas de notification. Le texte du commentaire ou la légende dans l’alerte. La messagerie. L’export. Réécrire les plans des tranches 1 à 16.
