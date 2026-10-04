# Instacrane — spec

Source de vérité pour la reprise. On n’implémente une tranche qu’une fois cette spec validée, et seulement cette tranche.

## Intention

Le backend Python et le site SvelteKit sont remplacés. L’API est en Go. Le client est une app Expo : les mêmes écrans sur iOS, Android et le web. Le produit couvre des comptes privés, leurs profils, le suivi, les photos, un fil, les likes, les commentaires, et les notifications qui en découlent. Il n’y a pas d’explore. L’identité vient de l’issuer. Il n’y a plus de mot de passe Instacrane.

## Décisions

- Backend en Go. Client unique en Expo (React Native), ciblant l’App Store, le Play Store et le web. Le SvelteKit sort du dépôt à la bascule.
- L’app obtient la session auprès de l’issuer. L’API ne fait que la vérifier. Le `sub` est l’identité.
- L’app renouvelle la session au démarrage, au retour au premier plan et quand l’API refuse l’accès. Un seul renouvellement à la fois.
- Issuer, identifiant de client et adresses de retour vivent dans la configuration locale. Cette spec n’en contient aucun.
- Au premier appel authentifié, l’API crée le profil s’il n’existe pas et recopie l’email du jeton quand il est présent. L’email n’est pas modifiable dans l’app.
- Le nom d’utilisateur public (`^[a-zA-Z0-9_.]+$`, 3 à 30 caractères, unique) est le complément Instacrane. Le jeton de l’issuer est déjà valable. L’app envoie vers l’écran de choix tant que le nom est vide, et l’API refuse de publier, commenter ou suivre tant qu’il n’est pas posé. `GET /api/users/me` et le `PATCH` qui pose le nom restent autorisés. Une fois choisi, le nom ne change plus.
- Nom affiché, bio et avatar restent locaux.
- Postgres local via le `docker compose` actuel. Les migrations remplacent le `create_all` au démarrage. En local, les images passent par MinIO.
- L’auth locale (`/api/auth/register`, `/api/auth/login`) disparaît. Il n’y a pas de route explore.
- Les identifiants de comptes (Apple, Google Play, Expo, Scaleway) vivent dans la configuration locale. Cette spec n’en contient aucun.

## Hébergement

L’API, Postgres et le site web tournent sur l’hôte de l’API, tant que le disque, le processeur et la mémoire suffisent. Le site des premières versions est l’export web Expo, servi depuis cet hôte. Les images n’y sont pas stockées.

Les images vont dans un bucket Scaleway privé, classe standard multi-zones. Le dépôt contient le Terraform de ce bucket seul : pas d’API, pas de base, pas de site. Le compte Scaleway se crée à la main. L’identifiant de projet, le nom du bucket et les clés d’accès restent dans un fichier local ignoré par git. On applique ce Terraform une fois le compte créé.

La base enregistre des clés d’objet, pas l’adresse du fournisseur. Changer de stockage plus tard, c’est copier les objets et changer la configuration.

## Données personnelles

On ne garde que ce qui est nécessaire pour faire fonctionner le service. Pas de mot de passe, pas de fichier original, pas de métadonnées de l’appareil, pas de date de naissance, pas de cookies, pas de mesure d’audience, pas de publicité. Une position n’est gardée que sur une publication, et seulement si l’auteur active le bouton et en choisit une. L’email vient de l’issuer, n’est pas modifiable dans l’app, et n’est jamais montré aux autres utilisateurs. Les images restent dans le stockage objet en France. L’API et la base restent sur l’hôte déjà choisi. Aucun autre destinataire, sauf le service d’alerte du téléphone lorsque l’utilisateur l’a accepté : il ne reçoit alors que le jeton de l’appareil et le texte de l’alerte.

Ce que la première version fait :

- L’app explique, sur un écran dédié, quelles données sont gardées et pourquoi, et comment supprimer le compte. Le texte juridique détaillé n’est pas dans cette spec.
- Chacun corrige son nom affiché, sa bio et son avatar.
- `DELETE /api/users/me` efface le profil, les follows dans les deux sens, les likes, les commentaires écrits, les publications et toutes leurs photos, l’avatar, les notifications liées à ce compte et le jeton d’alerte. Il ne reste pas de trace publique. L’app demande une confirmation.

L’export des données (accès et portabilité) n’est pas dans la première version. Le modèle le permet déjà : toute ligne et toute clé d’objet se rattache au `sub`. L’ajouter plus tard est une lecture, pas une migration. Le nom d’utilisateur n’est pas la clé, donc une correction ultérieure reste possible. La première version ne propose pas de le changer.

Une sauvegarde ne sert qu’à la reprise après incident. Elle ne réintroduit pas un compte effacé.

## Hors périmètre

- Déménagement de l’API hors de son hôte, choix de machine et région au-delà du bucket. Le conteneur API continue d’écouter sur le port 8000.
- Stories, messages, explore et republication. Toute notification autre que le like, le commentaire et la demande de suivi. Les comptes publics.
- Changement de nom d’utilisateur une fois choisi.
- Export des données personnelles. Reporté à une version ultérieure. Le modèle de cette spec le permet déjà.
- Remontée d’un signalement vers l’issuer, et la répercussion d’un blocage ou d’une suppression décidés là-bas. Évolution ultérieure, décrite plus bas. La première version n’envoie rien à l’issuer.
- Capacitor, et un second client SvelteKit maintenu à côté de l’app.
- Une session émise par l’API, ou une connexion dont les paramètres seraient écrits dans le dépôt.
- Conserver le fichier original de l’appareil. Les vidéos. Le seul média est une photo.

## Auth

L’app se connecte via la configuration locale. L’API accepte la session et en tire le `sub` et l’email.

- Sans session : écran de connexion.
- Session refusée par l’API : l’app la renouvelle. Si le renouvellement échoue, retour à la connexion. Une coupure réseau ne déconnecte pas.
- `GET /api/users/me` crée le profil depuis le `sub` s’il manque, et met à jour l’email quand la session en fournit un.
- Tant que `username` est vide, publier, commenter ou suivre est refusé. Le `PATCH` du nom est le seul moyen de le poser.

## API

Tout appel sauf `GET /api/health` exige une session valide.

- `GET /api/health`
- `GET /api/users/me`, `PATCH /api/users/me` (`username` une seule fois, `display_name`, `bio`), `POST /api/users/me/avatar`, `DELETE /api/users/me`
- `GET /api/users/{username}`
- `GET /api/users/{username}/posts`
- `GET /api/users/{username}/followers`, `GET /api/users/{username}/following`
- `POST /api/users/{username}/follow`, `DELETE /api/users/{username}/follow`
- `GET /api/users/me/follow-requests`
- `POST /api/users/{username}/follow/accept`, `DELETE /api/users/{username}/follow/request`
- `GET /api/users/search/{query}`
- `POST /api/posts` (une à vingt photos, légende, localisation facultative : position du moment ou position de la photo), `GET /api/posts/feed`, `GET /api/posts/{id}`, `DELETE /api/posts/{id}`
- `POST` et `DELETE /api/posts/{id}/like`
- `GET` et `POST /api/posts/{id}/comments`, `DELETE /api/posts/{id}/comments/{comment_id}`
- `GET /api/notifications`, `POST /api/notifications/read`
- `POST /api/users/{username}/block`, `DELETE /api/users/{username}/block`
- `POST /api/users/{username}/report`, `POST /api/posts/{id}/report`

L’écran profil consomme `GET /api/users/{username}/posts`. La grille reçoit la miniature de la première photo. Le fil et le détail reçoivent les photos d’affichage, dans l’ordre, avec le nombre de likes et de commentaires. Si l’auteur a choisi une localisation, elle apparaît avec la publication. Sinon, il n’y en a pas. On trouve un compte par la recherche, puis on lui envoie une demande avec son nom d’utilisateur. Lui seul accepte ou refuse. Le profil affiche les deux compteurs, abonnés et abonnements, et chacune de ces listes. Ces compteurs ne comptent que les demandes acceptées. Le fil et la grille chargent les publications plus anciennes au fil du défilement.

Quitter la session efface les jetons sur l’appareil, et le jeton d’alerte. On peut effacer un commentaire qu’on a écrit, ou un commentaire reçu sur sa publication.

## Visibilité

Tous les comptes sont privés. Sans session, on ne voit rien.

Au départ, le fil ne contient que ses propres publications, la plus récente d’abord. Tous les comptes sont privés : suivre quelqu’un commence par une demande. On le trouve par son nom, on la lui envoie, et lui seul l’accepte. Une demande acceptée donne accès à ses photos, dans le fil et sur son profil. Ça ne lui donne pas accès aux nôtres. Pour voir les nôtres, il envoie sa propre demande, et on l’accepte à part. Si les deux demandes sont acceptées, les deux fils se mélangent.

On peut trouver un compte et en voir le nom, l’avatar et la bio avant toute acceptation. Ses photos n’apparaissent que si notre demande a été acceptée, ou si c’est nous. Une demande encore en attente ne les ouvre pas. Aimer ou commenter une publication exige de pouvoir la voir. Un blocage retire en plus ces publications du fil, comme déjà décrit.

## Images

On ne garde pas le fichier de l’appareil. Avant l’envoi, l’app produit une image d’affichage : grand côté 1440 pixels, JPEG ou WebP, sans métadonnées, donc sans position. L’API n’enregistre pas de version plus grande. Si le fichier reçu dépasse cette taille, elle le réduit à 1440 et oublie l’original. Le fichier enregistré ne contient pas de position.

Au moment de publier, un bouton de localisation est éteint. Éteint, aucune position n’est gardée. Allumé, l’auteur choisit une seule source : la position du moment, proposée par l’app, ou la position lue dans la photo avant qu’elle soit dépouillée de ses métadonnées. L’autre source est oubliée. La position retenue est montrée avec la publication à ceux qui peuvent la voir, et elle part avec la publication quand elle est effacée. Le bouton peut rester éteint.

Une publication contient de une à vingt photos, dans un ordre. Pour chacune, l’API stocke l’affichage et une miniature de 480 pixels. La grille du profil utilise la miniature de la première. L’avatar est un seul fichier, grand côté 512 pixels, stocké de la même façon. Supprimer la publication retire toutes ses photos.

L’app demande l’image à l’API. Si ce compte a le droit de la voir, l’API répond par un lien de quelques minutes, signé avec les clés du bucket. Ces clés ne quittent pas l’API. L’app charge le fichier directement, puis le garde sur l’appareil. Le lien n’est pas mis en cache : s’il a expiré, l’API en signe un autre. Si la publication n’est plus visible, l’app retire le fichier du cache. L’avatar suit la même règle.

## Données

`users` est clé par `sub` (texte, identifiant OIDC). Colonnes : `email`, `username` unique et nul tant qu’il n’est pas choisi, `display_name`, `bio`, une clé d’avatar, `created_at`. Pas de mot de passe, pas de second identifiant, pas d’adresse de fichier.

`follows`, `posts`, `comments`, `likes` référencent ce `sub`. Un suivi est unique par couple. Il est en attente, ou accepté. Seul l’état accepté ouvre les photos de la personne suivie. Chaque publication a une légende et, seulement si l’auteur a allumé le bouton et choisi une source, une position : celle du moment, ou celle qui était dans la photo. Chaque publication a une liste ordonnée de photos. Chaque photo a deux clés, affichage et miniature, pas l’original. L’avatar a une seule clé. Le like et le commentaire portent sur la publication, pas sur une photo en particulier.

Une notification référence le destinataire, l’auteur de l’action, le type (like, commentaire, demande de suivi) et, pour un like ou un commentaire, la publication. Pas d’autre contenu. Le jeton d’alerte, s’il existe, est rattaché au même `sub` et ne sert qu’à ça.

## Signalement et blocage

Exigé pour publier sur les stores. Depuis un profil, on signale le compte ou on le bloque. Depuis une publication, on la signale. Un signalement garde qui signale, la cible, et le moment. Rien d’autre.

Bloquer empêche les deux comptes de se suivre, de s’aimer et de se commenter. Les demandes en attente partent aussi, dans les deux sens. Le fil de l’un ne montre plus les publications de l’autre. Débloquer annule ça. Supprimer un compte retire ses blocages. Un signalement qui le concerne part avec lui.

Plus tard, l’issuer pourra recevoir un signalement remonté par une plateforme, puis bloquer ou supprimer cette identité. Il prévient alors les clients, sans attendre la prochaine connexion : un blocage retire l’accès aux publications, une suppression efface les contenus rattachés au `sub`, dont l’avatar. Un signalement Instacrane ne part pas tout seul vers l’issuer. Quelqu’un en décide là-bas. La première version ne fait pas ce lien. Le modèle est déjà prêt, parce que tout est rangé par `sub` et que la suppression locale sait déjà tout effacer.

## Notifications

Trois cas, et rien d’autre. Quelqu’un aime une publication : l’auteur est prévenu. Quelqu’un la commente : l’auteur est prévenu. Quelqu’un demande à nous suivre : une notification est créée, pour accepter ou refuser. Accepter lui ouvre nos photos. Ça n’ouvre pas les siennes. Agir sur son propre contenu, ou se suivre soi-même, ne crée rien.

La liste est dans l’app, ouverte par une cloche. La cloche est marquée tant qu’une demande de suivi est en attente, ou qu’une notification n’est pas lue. L’alerte sur le téléphone part seulement si l’utilisateur l’a acceptée. Sinon, aucun jeton n’est gardé. Retirer l’acceptation efface le jeton.

## Client

L’interface des écrans qu’on a suit celle d’Instagram : barre du bas, carte du fil, grille du profil, cloche des notifications. Pas d’explore, pas de stories.

Une publication peut regrouper plusieurs photos. S’il y en a plus d’une, une petite icône de pile le signale sur la grille et sur le fil. On passe d’une photo à l’autre en glissant le doigt. Sur la photo affichée, pincer avec deux doigts zoome, et un double appui l’aime. Sous la publication, le nombre de likes et de commentaires. Le like et le commentaire valent pour toute la publication. Pas de republication.

L’app a les écrans connexion, choix du nom d’utilisateur, fil, publication, profil, détail d’un post, listes d’abonnés et d’abonnements, demandes de suivi reçues, notifications, signalement, blocage, et explication des données. On cherche un compte, on lui envoie une demande, et on accepte ou on refuse celles qu’on reçoit. Le fil et la grille du profil défilent et chargent les publications plus anciennes. On peut quitter la session, et effacer un commentaire qu’on a écrit ou reçu sur sa publication. La suppression du compte y est confirmée avant l’appel. Sans jeton, l’app montre la connexion. Avec un jeton et sans nom d’utilisateur, elle montre l’écran de choix. Ensuite, l’app. La publication et l’avatar passent par le sélecteur d’images, puis par la réduction décrite dans Images, avant l’envoi. Au moment de publier, le bouton de localisation est éteint. Allumé, on choisit la position du moment ou celle de la photo. Éteint, la publication n’en a pas. Le web est l’export Expo, pas un site SvelteKit.

Le SvelteKit actuel sert de référence fonctionnelle le temps de la réécriture, puis il est retiré.

## Stores

La tranche stores produit des builds iOS et Android, et l’export web. La soumission sur les stores suppose que les comptes développeur sont déjà configurés localement.

## Vérification

Chaque tranche a des tests automatisés sur le comportement qu’elle ajoute. La tranche client se vérifie sur le web Expo et sur un simulateur ou un appareil. Les tests d’API utilisent un issuer de test. La connexion réelle dépend de la configuration locale. Les images de test passent par MinIO. Le bucket Scaleway se vérifie par `terraform validate`, puis par un apply manuel une fois le compte créé.

Renovate surveille les bibliothèques.

- Une zéro-day est mise à jour le jour où le correctif existe. Le délai de 30 jours ne s’applique pas.
- Un correctif ou une version mineure, sans faille, est fusionné par GitHub dès que la CI passe.
- Une version majeure, et une faille qui n’est pas une zéro-day, sont adoptées 30 jours après la publication de la version. On ne prend pas une bibliothèque avant ce délai.

## Découpage

Une tranche à la fois. On ne commence la suivante que lorsque la précédente est vérifiée.

1. **Socle.** Module Go, configuration par l’environnement, connexion Postgres, migrations du schéma ci-dessus, `GET /api/health`. `docker compose` inchangé. Vérifié par les tests de migration et l’appel health.
2. **Auth.** Vérification de la session, création du profil au premier `GET /api/users/me`, copie de l’email, refus des actions tant que le nom d’utilisateur est vide, `PATCH` qui le pose une fois. Vérifié par des tests avec un issuer de test.
3. **Profils.** Édition, avatar en 512 traité comme les autres images, fiche visible selon la demande de suivi, recherche, envoi, acceptation et refus d’une demande, compteurs et listes d’abonnés et d’abonnements, posts d’un utilisateur. Vérifié par des tests d’API.
4. **Publications.** Une à vingt photos par publication, chacune réduite à l’affichage 1440 et à la miniature 480, bouton de localisation, éteint ou allumé, et dans ce cas position du moment ou position de la photo, fil (soi, puis les publications des comptes dont la demande a été acceptée), détail, suppression, likes, commentaires, suppression d’un commentaire écrit ou reçu sur sa publication. Pas d’explore. Le défilement charge les publications plus anciennes. Chaque image visible est servie par un lien signé de quelques minutes. `DELETE /api/users/me` retire aussi les publications et toutes leurs photos. Vérifié par des tests d’API, stockage branché sur MinIO.
5. **Notifications.** Like, commentaire et demande de suivi créent une notification pour la personne concernée, visible dans `GET /api/notifications`. La demande en attente, comme une notification non lue, est ce que la cloche signalera. L’alerte téléphone n’existe que si elle a été acceptée. La suppression de compte retire les notifications et le jeton. Vérifié par des tests d’API.
6. **Signalement et blocage.** Signaler un compte, signaler une publication, bloquer et débloquer. Vérifié par des tests d’API.
7. **Client Expo.** Connexion, quitter la session, renouvellement, écran du nom d’utilisateur, fil, publication, profil, listes d’abonnés et d’abonnements, demandes de suivi reçues, cloche des notifications, détail, signalement, blocage, écran des données, suppression du compte. La cloche ouvre la liste et reste marquée tant qu’une demande est en attente ou qu’une notification n’est pas lue. Défilement infini du fil et de la grille. Carrousel : icône, glisser d’une photo à l’autre, pincer pour zoomer, double appui pour aimer, compteurs sous la publication. L’image est gardée sur l’appareil, pas le lien. Pas d’explore, pas de republication. L’app réduit chaque photo avant l’envoi. Vérifié sur le web et sur un simulateur. La connexion réelle attend la configuration locale.
8. **Bascule.** L’image et la CI backend passent au Go. Le Python et le SvelteKit sortent du dépôt. L’API et le site web restent sur l’hôte de l’API. Le Terraform du bucket est déjà dans le dépôt ; on l’applique quand le compte Scaleway existe.
9. **Stores.** Builds iOS et Android, une fois le signalement et le blocage en place. La soumission sur l’App Store et le Play Store se fait quand les comptes sont configurés localement.
