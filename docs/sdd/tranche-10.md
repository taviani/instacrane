# Tranche 10 — mise en service

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

La tranche 9 a posé la configuration de build, sans identifiant de compte. Elle n’a pas le workflow manuel. Cette tranche l’ajoute, et met l’image sur l’hôte.

## Fait quand

- L’image tourne sur l’hôte déjà choisi, port 8000, avec Postgres et le bucket privé. `GET /api/health` répond sur cet hôte.
- Le site public est ce même processus. Dans l’image, l’adresse d’API est vide.
- Le client chez l’issuer accepte le retour de ce site et le retour `instacrane`, chemin `/redirect`. Le navigateur termine l’échange depuis l’origine du site.
- Une connexion depuis ce site arrive à l’écran du nom, ou au fil si le nom est déjà choisi.
- Un workflow manuel lance les builds téléphone. Il ne part ni à la poussée ni à la pull request. Deux cases : soumettre iOS vers TestFlight, soumettre Android vers la piste interne. Aucune case : build iOS seul, sans soumission. La case Android seule construit Android et le soumet, sans build iOS. Les deux cases construisent les deux et les soumettent. Android n’est pas construit sans sa soumission.
- Ce workflow lit `EXPO_TOKEN`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ISSUER_URL`, `EXPO_PROJECT_ID`. `EXPO_PUBLIC_CLIENT_ID` et `EXPO_OWNER` s’y ajoutent. `EXPO_ASC_APP_ID` est exigé quand la case iOS est cochée. Le compte de service Android est lié dans EAS. Aucune de ces valeurs n’est dans le dépôt. L’adresse d’API, l’issuer et l’identifiant de client du téléphone viennent de ces secrets au moment du build.
- Le dépôt ne reçoit ni le nom de l’hôte, ni une clé, ni un identifiant de compte.

## Où

```
.github/workflows/   le workflow manuel
hors du dépôt        l’image sur l’hôte, son environnement, les secrets, le retour chez l’issuer
```

`client/app.config.js` et `client/eas.json` restent ceux de la tranche 9. Le workflow y injecte les valeurs au lancement, sans les commiter. L’API et le Terraform du bucket ne changent pas.

## On ne fait pas

Réécrire la configuration de build de la tranche 9. Lancer ce workflow à chaque poussée. L’export des données, l’envoi réel des alertes, Renovate.
