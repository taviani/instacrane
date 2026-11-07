# Correction 9 — plus de question d’algorithme à chaque build

Plan. Le produit reste celui de `spec.md`.

Apple bloque un build TestFlight tant qu’on n’a pas dit si l’app chiffre autrement que par HTTPS. L’app ne le fait pas. La déclaration part dans le build, une fois.

## Fait quand

- `ITSAppUsesNonExemptEncryption` vaut faux dans le `Info.plist` iOS.
- Aucun identifiant de compte n’entre dans le dépôt.
- Le prochain build soumis ne redemande pas la question. Le build déjà chez Apple reste en attente : une réponse manuelle, ou un nouveau build.

## Où

```
client/app.json
client/src/store-config.test.ts
```

## On ne fait pas

Déclarer un chiffrement propre. Répondre à la place d’Apple pour le build déjà envoyé. Lancer un build.
