# Correction 6 — le navigateur peut lire le bucket

Plan. Le produit reste celui de `spec.md`. Ce n’est pas la tranche 11.

Sur le web, la publication arrive, puis la photo reste un cadre vide. L’app télécharge le lien signé pour garder le fichier. Le bucket privé ne laisse pas le navigateur lire cet objet.

## Fait quand

- Le bucket reste privé.
- Il autorise le GET depuis les origines du site, pour que l’app garde le fichier.
- Ces origines ne sont pas dans le dépôt. Elles sont dans le fichier local déjà ignoré, avec le nom du bucket.
- `terraform validate` passe.

## Où

```
infra/main.tf
```

## On ne fait pas

Ouvrir le bucket. Changer le client. Appliquer le Terraform : ça reste à la main. Réécrire le plan de la tranche 8.
