# Correction 2 — l’inscription reste chez l’issuer

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

L’application n’a pas d’écran d’inscription. Une personne sans compte chez l’issuer ne peut pas commencer. Le compte se crée chez l’issuer.

## Fait quand

- L’application ne gagne pas d’écran d’inscription.
- Quand l’issuer affiche la connexion d’un client public qui n’est pas sur invitation, l’écran propose le formulaire d’inscription.
- Un client sur invitation ne propose pas ce lien.
- Le client public ne détient toujours pas de secret, et ne demande pas lui-même l’inscription.

## Où

```
hors du dépôt    l’issuer, sur son écran de connexion
```

Le dépôt ne nomme ni l’issuer ni les autres clients.

## On ne fait pas

Un formulaire d’inscription dans l’application. Un mot de passe dans l’application. Ouvrir l’inscription d’un client sur invitation.
