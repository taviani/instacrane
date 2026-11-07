# Correction 8 — se déconnecter ferme aussi l’issuer

Plan. Le produit reste celui de `spec.md`.

Relancer l’app retrouve la session, sans mot de passe. Se déconnecter est le seul geste qui l’efface, et il ferme aussi la session chez l’issuer. Le cookie de l’issuer ne part qu’en allant sur son site.

## Fait quand

- Sans cette action, les jetons restent sur l’appareil et le démarrage retrouve la session.
- Se déconnecter retire le jeton d’alerte, efface les jetons locaux, puis ouvre la déconnexion de l’issuer.
- L’issuer révoque sa session et renvoie vers le retour déjà enregistré pour ce client. Une autre adresse ne reçoit personne.
- Le prochain Se connecter redemande le mot de passe.

## Où

```
client/src/issuer-logout.ts
client/src/auth.ts
client/src/session.tsx
```

Le `GET /logout` est chez l’issuer.

## On ne fait pas

Fermer l’issuer à chaque lancement. Changer le cookie de l’issuer. Réécrire les plans déjà fermés.
