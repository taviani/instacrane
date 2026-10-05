# Correction 1 — l’origine de l’API ne sert pas le site

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

La mise en service a placé le site et l’API sur deux origines, devant le même processus. L’origine de l’API renvoyait aussi l’application.

## Fait quand

- Une adresse de l’origine d’API autre que `/api` ne renvoie pas l’application.
- `GET /api/health` sur cette origine répond.
- Les origines du site servent toujours l’export.

## Où

```
hors du dépôt    la porte devant le processus
```

Le dépôt ne nomme ni l’hôte ni les origines. Le processus Go ne change pas : en dehors de `/api`, il sert l’export. C’est la porte qui limite l’origine d’API à `/api`.

## Déjà fait

La porte sur l’hôte limite déjà l’origine d’API à `/api`. Ce plan enregistre la règle. Il n’ajoute pas de code.

## On ne fait pas

Nommer l’hôte ou les origines dans le dépôt. Changer le processus Go. L’export des données.
