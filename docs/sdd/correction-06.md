# Correction 6 — le navigateur peut lire le bucket

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

Sur le web, la publication arrive, puis la photo reste un cadre vide. L’app télécharge le lien signé pour garder le fichier. Le bucket privé ne laisse pas le navigateur lire cet objet.

## Fait quand

- Le bucket reste privé.
- Il autorise le GET depuis les origines du site, pour que l’app garde le fichier.
- GitHub applique cette description. Le nom du bucket, l’identifiant de projet, les clés et les origines sont des secrets du workflow. Aucune de ces valeurs n’est dans le dépôt.
- L’état Terraform est dans le stockage d’objets. Si cet état ne connaît pas encore le bucket, le workflow l’adopte, puis applique.
- `terraform validate` passe. Le déploiement du site n’attend pas cet apply.

## Où

```
infra/main.tf
.github/workflows/infra.yml
```

## On ne fait pas

Ouvrir le bucket. Changer le client. Laisser l’état sur un ordinateur. Réécrire le plan de la tranche 8.
