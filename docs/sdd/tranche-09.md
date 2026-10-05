# Tranche 9 — stores

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Le dépôt peut produire un build iOS et un build Android de l’app déjà en place. Les mêmes écrans, le même schéma `instacrane`.
- L’identifiant iOS et le paquet Android restent `app.instacrane`. Les comptes Apple, Google et Expo déjà configurés localement servent au build et à la soumission. Leurs identifiants ne sont pas écrits dans le dépôt : ni équipe, ni application de store, ni projet de build, ni clé.
- L’export web reste celui déjà servi par l’image, sur le port 8000. Cette tranche n’en produit pas un second.
- La CI vérifie que la configuration du client se charge, et qu’aucun identifiant de compte n’y est écrit. Les builds et la soumission partent de la machine locale, avec ces comptes.

## Où

```
client/          la configuration de build, sans compte
```

L’API, le bucket et l’image ne changent pas.

## On ne fait pas

Écrire les identifiants de compte dans le dépôt. Copier l’image sur l’hôte. Créer d’autres adresses de retour chez l’issuer. L’envoi réel des alertes, le compteur de vues, la recommandation, la remontée d’un signalement vers l’issuer, Renovate.
