# Tranche 7 — client Expo

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Une seule app Expo. Les mêmes écrans sur iOS, Android et le web. Le web est l’export Expo. Le SvelteKit reste dans le dépôt : il sert encore de référence, et il sort à la bascule.
- Sans session, l’écran de connexion. Avec une session et sans nom d’utilisateur, l’écran de choix. Ensuite, l’app. L’email n’est pas modifiable, et il n’est jamais montré aux autres.
- L’app obtient la session auprès de l’issuer. L’API ne fait que la vérifier. Elle renouvelle au démarrage, au retour au premier plan, et quand l’API refuse l’accès. Un seul renouvellement à la fois. Une coupure réseau ne déconnecte pas. Si le renouvellement échoue, retour à la connexion.
- Quitter la session efface les jetons sur l’appareil, et retire le jeton d’alerte.
- La barre du bas mène au fil, à la recherche, à la publication, à la cloche et au profil. Pas d’explore, pas de stories, pas de messages, pas de republication.
- Le fil est une suite chronologique, la plus récente d’abord, ses publications et celles des comptes dont la demande a été acceptée. La grille du profil est carrée, la plus récente d’abord. Les deux défilent et chargent les plus anciennes. Le détail montre les photos d’affichage, dans l’ordre choisi, en portrait 4:5.
- Avant l’envoi, chaque photo est cadrée en portrait 4:5, puis réduite. Le bouton de localisation est éteint. Allumé, une seule source : la position du moment, ou celle lue dans la photo avant qu’elle soit dépouillée. L’autre est oubliée.
- L’image est gardée sur l’appareil, pas le lien. S’il a expiré, l’app en redemande un. Si la publication n’est plus visible, le fichier en cache part.
- La cloche ouvre la liste. Elle reste marquée tant qu’une demande est en attente ou qu’une notification n’est pas lue. Marquer comme lu n’éteint pas une demande encore en attente.
- On cherche un compte, on demande à le suivre, on accepte ou on refuse. On signale un compte ou une publication, sans motif. On bloque et on débloque. La fiche dit le blocage seulement à celui qui l’a posé.
- L’écran des données dit ce qui est gardé et pourquoi, et comment supprimer le compte. La suppression est confirmée avant l’appel.
- L’adresse de l’issuer, l’identifiant de client et les adresses de retour viennent de la configuration locale. Rien de tout ça dans le dépôt. Tant que cette configuration n’existe pas, la connexion réelle n’est pas jouée.
- Les écrans se vérifient sur le web Expo et sur un simulateur, avec l’API locale et l’issuer de test.
- `backend/`, `infra/`, `docker-compose.yml` et le SvelteKit sont inchangés. L’API n’est pas réécrite.

## Virginie et Paul

Virginie ouvre l’app. Pas de session : l’écran de connexion. Une fois la session là, elle n’a pas de nom : l’écran de choix. Elle pose `virginie`. Elle arrive sur le fil, qui ne contient que ses propres publications.

Elle cherche Paul. La fiche montre son nom, son avatar, sa bio, pas ses photos. Elle envoie une demande. Paul voit la cloche marquée. Il ouvre la liste, marque comme lu : la cloche reste marquée tant qu’il n’a pas accepté ou refusé. Il accepte. Virginie voit alors tout l’historique de Paul, dans la grille et dans le fil, à la date d’enregistrement. Paul ne voit pas les photos de Virginie. Pour ça, il envoie sa propre demande.

Virginie publie. Le bouton de localisation est éteint : la publication n’a pas de position. Elle en allume un, choisit la position du moment, et oublie celle de la photo. S’il y a plusieurs photos, une icône de pile le signale. Sur le détail, elle glisse d’une photo à l’autre, pince pour zoomer, double-appuie pour aimer. La légende s’affiche comme le premier commentaire, avec son nom, puis les commentaires. Le nombre de commentaires ne compte pas la légende.

Paul bloque Virginie. Elle ne voit plus ses photos, et une nouvelle demande est refusée sans dire qu’elle est bloquée. La fiche de Paul reste ouverte. Paul, sur la fiche de Virginie, voit que le blocage est le sien, et il peut débloquer. Il voit toujours les photos de Virginie s’il la suivait déjà.

Virginie signale le compte de Paul, puis une publication qu’elle peut voir. Rien à écrire : pas de motif. Elle ouvre l’écran des données, confirme, et supprime son compte. L’app revient à la connexion.

## Session

Les jetons restent sur l’appareil. Quitter la session les efface, et appelle le retrait du jeton d’alerte.

L’alerte sur le téléphone n’est proposée que comme un choix. Acceptée, l’app enregistre le jeton de l’appareil s’il y en a un. Retirer l’acceptation l’efface. Sur le web, il n’y a pas de jeton d’appareil : accepter n’enregistre rien. L’envoi réel vers le téléphone n’est pas dans cette tranche.

## Images

Le sélecteur fournit la photo. L’app la cadre en portrait 4:5, puis la réduit avant l’envoi, comme l’API le refera si le fichier arrive autrement. Une publication en contient de une à vingt. La grille montre le carré central de la première.

Le lien signé sert à charger le fichier. L’app garde le fichier. Le lien n’est pas mis en cache. L’avatar suit la même règle.

## Où

L’app vit à côté du SvelteKit, sans le remplacer.

```
client/          app Expo, les mêmes écrans sur iOS, Android et le web
```

Elle parle à l’API déjà en place. Pas de nouvelle route.

## Écrans

- Connexion, puis choix du nom d’utilisateur tant qu’il est vide. Une fois choisi, il ne change plus.
- Fil, détail, publication. Compteurs de likes et de commentaires sous la publication. Effacer un commentaire qu’on a écrit, ou un commentaire reçu sur sa publication.
- Profil, avec la grille, les compteurs, les listes d’abonnés et d’abonnements. Nom affiché, bio et avatar se modifient. La recherche mène à une fiche, puis à une demande.
- Demandes reçues : accepter ou refuser.
- Cloche : la liste, la plus récente d’abord. Marquer comme lu.
- Signaler un compte depuis sa fiche. Signaler une publication depuis son détail. Bloquer et débloquer depuis la fiche.
- Explication des données, et suppression du compte après confirmation.

## On ne fait pas

Le déploiement, le paramétrage de l’hôte, le bucket, la sortie du Python et du SvelteKit, les builds de stores, la soumission, l’envoi réel des alertes, le compteur de vues, la recommandation, la remontée d’un signalement vers l’issuer, Renovate.
