# Instacrane — spec

Source de vérité. On n’implémente une tranche qu’une fois cette spec validée, et seulement cette tranche.

## Produit

API en Go. Une app Expo, les mêmes écrans sur iOS, Android et le web. Comptes privés, profils, suivi, photos, un fil, likes, commentaires, notifications. L’identité vient de l’issuer. Pas de mot de passe, pas de cookies, pas de date de naissance.

L’app obtient la session auprès de l’issuer. L’API la vérifie. Le `sub` est l’identité. L’app renouvelle au démarrage, au retour au premier plan, et quand l’API refuse l’accès. Un seul renouvellement à la fois. Une coupure réseau ne déconnecte pas.

L’application n’a pas d’écran d’inscription. Le compte se crée chez l’issuer. Quand l’issuer affiche la connexion d’un client public qui n’est pas sur invitation, l’écran propose le formulaire d’inscription à qui n’a pas encore de compte. Un client sur invitation ne propose pas ce lien.

Au premier appel authentifié, l’API crée le profil et recopie l’email du jeton. L’email n’est pas modifiable, et il n’est jamais montré aux autres. Nom affiché, bio et avatar sont locaux.

Le nom d’utilisateur (`^[a-zA-Z0-9_.]+$`, 2 à 30 caractères, unique) se choisit une fois. `me` et `search` sont refusés. Tant qu’il est vide, l’app reste sur l’écran de choix. Publier, commenter, suivre, bloquer et signaler sont refusés. `GET /api/users/me`, le `PATCH` du nom, et aimer restent autorisés.

Tous les comptes sont privés. Sans session, on ne voit rien. On peut trouver un compte et voir son nom, son avatar, sa bio et son nombre de publications avant toute acceptation. Ses photos n’apparaissent que si notre demande a été acceptée, ou si c’est nous. Une demande en attente ne les ouvre pas. Une publication invisible se comporte comme si elle n’existait pas, y compris pour aimer ou commenter.

La recherche trouve un compte par son nom d’utilisateur, son nom affiché ou sa bio. Elle trouve aussi une publication par sa légende, seulement quand on peut la voir. Un compte ouvre sa fiche. Une publication s’affiche comme dans le fil. Les commentaires ne sont pas cherchés.

Suivre commence par une demande. Seul le destinataire accepte ou refuse. Acceptée, elle ouvre tout l’historique de photos, dans la grille et dans le fil. Le suivi inverse est une autre demande. Les compteurs et les listes d’abonnés et d’abonnements ne comptent que les demandes acceptées.

Le fil est une suite chronologique, la plus récente d’abord, selon l’heure d’enregistrement, pas l’heure de la photo. Il mêle ses publications et celles des comptes dont la demande a été acceptée. Dans une publication, les photos restent dans l’ordre choisi. La grille du profil est carrée, la plus récente d’abord. Les deux chargent les plus anciennes. Ni le fil ni la grille n’ouvrent un écran de publication.

Une publication a de une à vingt photos. S’il y en a plus d’une, une icône de pile le signale. On glisse horizontalement d’une photo à l’autre, on pince pour zoomer, on double-appuie pour aimer. Un glissement vertical sur la photo fait défiler le fil. Le double-appui montre un cœur sur la photo et pose le like. Un second double-appui ne le retire pas. Sous la photo, le nombre de likes est devant un cœur transparent, rouge quand on a aimé. Un appui sur le cœur pose le like, un second le retire. Un appui sur ce nombre ouvre la page des personnes qui ont aimé, la plus récente d’abord. Le nombre compte tous les likes. La page montre ceux qui ont un nom d’utilisateur, et ce nom ouvre la fiche. Une bulle porte le nombre de commentaires. Ni le mot j’aime, ni le mot commentaire. Le like et le commentaire valent pour toute la publication. La légende s’affiche avec le nom de l’auteur, puis l’aperçu du premier commentaire, le plus ancien. La légende n’est pas un commentaire, et le compteur ne l’inclut pas. Elle peut être vide. 2200 caractères au plus. Un commentaire, 1000. L’heure d’enregistrement est une durée relative : il y a 26 minutes, il y a 3 jours, il y a une semaine. Trois points sur la publication : l’auteur y efface, les autres y signalent. Le champ pour commenter n’est pas sous la photo. La bulle ouvre la page des commentaires, du plus ancien au plus récent, avec le champ d’envoi en bas. Le plus ouvre un choix : photothèque, caméra ou fichier. La publication part sans légende ni position. L’auteur les ajoute ensuite, sur la publication. Publier ramène au fil.

Chaque photo de publication est un portrait 4:5. L’app cadre avant l’envoi. L’API recadre au centre si la proportion diffère, puis réduit sans agrandir : grand côté 1440 pixels, donc 1152×1440 au plus. Entrée JPEG, PNG ou WebP. Fichier gardé en JPEG, sans métadonnées. La miniature est le carré central, 480 pixels au plus. L’avatar n’est pas forcé en 4:5 : grand côté 512. L’original de l’appareil n’est pas gardé.

La position s’ajoute après, sur la publication. Le bouton est éteint. Allumé, une seule source : la position du moment, ou celle lue dans la photo avant qu’elle soit dépouillée. L’autre est oubliée. Les deux coordonnées ensemble, ou aucune. L’API ne lit pas la position dans le fichier. La position choisie est montrée avec la publication et part avec elle. Elle n’est pas copiée sur le profil.

L’API répond par un lien signé de quelques minutes. L’app garde le fichier, pas le lien. S’il a expiré, l’API en signe un autre. Si la publication n’est plus visible, l’app retire le fichier.

On peut effacer un commentaire qu’on a écrit, ou un reçu sur sa publication. Quitter la session efface les jetons sur l’appareil et retire le jeton d’alerte de cet appareil. L’app demande confirmation avant de quitter la session, d’effacer une publication, de bloquer, de signaler ou de supprimer le compte.

## Notifications

Trois cas. Un like prévient l’auteur. Un commentaire prévient l’auteur. Une demande de suivi prévient le destinataire. Rien sur accepter, refuser, annuler, se retirer, retirer un like, effacer un commentaire, bloquer ou signaler. Agir sur son propre contenu ne crée rien. Un like qui ne crée pas de ligne ne crée pas une seconde notification.

La cloche est marquée tant qu’une demande est en attente ou qu’une notification n’est pas lue. Tout marquer comme lu n’éteint pas une demande encore en attente. Une notification liée à une publication ouvre la page de ses commentaires.

L’alerte hors de l’app part seulement si elle a été acceptée sur cet appareil. iOS, Android et le web peuvent chacun l’accepter. Chaque appareil garde son jeton. Un nouvel enregistrement du même appareil remplace le sien. Quitter la session, ou retirer l’acceptation, retire le jeton de cet appareil. Les autres restent. Supprimer le compte retire tous les jetons.

iOS envoie par le service d’Apple. Android envoie par le service de Google. Le web envoie par le navigateur. Le jeton de l’un ne sert pas aux deux autres. L’API connaît le genre et choisit le service. Sans la configuration de ce service, ou si l’envoi échoue, l’action reste réussie et la notification reste enregistrée. Un jeton que le service dit périmé est retiré.

Le texte est celui de la cloche. Pas l’email, pas le commentaire, pas la légende. L’alerte dit aussi où ouvrir : la page des commentaires s’il y a une publication, sinon les demandes reçues. Le système ne la montre pas quand l’app est au premier plan : la cloche suffit. Le navigateur ne la montre pas quand l’onglet du site est ouvert.

Sur iPhone, un onglet Safari ne reçoit pas d’alerte. Le site la reçoit une fois ajouté à l’écran d’accueil. Android et les navigateurs de bureau la reçoivent sans cet ajout. Le bouton des réglages demande l’autorisation au système. S’il refuse, les alertes restent éteintes et aucun jeton n’est gardé. Le site enregistre son service worker au moment de l’acceptation. Android range ces alertes dans un seul canal.

## Signalement et blocage

Depuis un profil, on signale le compte ou on le bloque. Depuis une publication visible, on la signale. Le signalement d’un compte contient la personne qui signale, la personne signalée, et le moment. Le signalement d’une publication contient la personne qui signale, la publication, et le moment. Pas de motif. Une nouvelle fois est une nouvelle ligne. Pas de notification. Se signaler ou se bloquer est refusé.

Bloquer n’est pas réciproque. Le suivi qui donnait à la personne bloquée l’accès aux photos de celui qui bloque est retiré, en attente ou accepté, et une nouvelle demande est refusée. Le suivi inverse reste. Les likes, commentaires et notifications déjà écrits restent. Débloquer retire l’interdiction de redemander, pas l’ancien suivi. La fiche reste visible. Elle dit le blocage seulement à celui qui l’a posé. Supprimer un compte retire ses blocages et les signalements qui le concernent.

## Données personnelles

On ne garde que ce qui fait fonctionner le service. Pas de mot de passe, pas de fichier original, pas de métadonnées de l’appareil, pas de date de naissance, pas de cookies, pas de mesure d’audience, pas de publicité. Une position n’existe que sur une publication dont le bouton était allumé. L’email vient de l’issuer. Les images restent dans le stockage objet en France. L’API et la base restent sur l’hôte déjà choisi. Le service d’alerte, s’il a été accepté, ne reçoit que le jeton de l’appareil, le texte de l’alerte et où l’ouvrir.

Un écran dit ce qui est gardé et comment supprimer le compte. La suppression est confirmée. `DELETE /api/users/me` retire le profil, les follows des deux sens, les likes, les commentaires écrits, les publications et leurs photos, l’avatar, les notifications et les jetons d’alerte. Une sauvegarde ne réintroduit pas un compte effacé.

Plus tard, le même écran permet de récupérer un zip de ce que le service garde pour ce compte : profil, avatar, publications et leurs photos, commentaires écrits, likes, suivis, notifications, blocages posés, signalements envoyés. Pas les photos des autres. Remonter un signalement vers l’issuer n’est pas dans cette version.

## Données

`users` est clé par `sub`. Colonnes : `email`, `username` unique et nul tant qu’il n’est pas choisi, `display_name`, `bio`, clé d’avatar, `created_at`.

`follows`, `posts`, `comments`, `likes` référencent ce `sub`. Un suivi est unique par couple, en attente ou accepté. Une publication a une légende, et une position seulement si le bouton était allumé. Chaque photo a deux clés, affichage et miniature. La base garde des clés d’objet, pas l’adresse du fournisseur.

Une notification référence le destinataire, l’auteur de l’action, le type, et la publication pour un like ou un commentaire. Chaque jeton d’alerte est rattaché au même `sub`, avec son genre : iOS, Android ou web. Un compte peut en avoir plusieurs.

## API

Tout appel sauf `GET /api/health` exige une session valide.

- `GET /api/health`
- `GET /api/users/me`, `PATCH /api/users/me`, `POST /api/users/me/avatar`, `DELETE /api/users/me`
- `GET /api/users/{username}`, `GET /api/users/{username}/posts`, `GET /api/users/{username}/followers`, `GET /api/users/{username}/following`
- `POST /api/users/{username}/follow`, `DELETE /api/users/{username}/follow`
- `GET /api/users/me/follow-requests`, `POST /api/users/{username}/follow/accept`, `DELETE /api/users/{username}/follow/request`
- `GET /api/users/search/{query}`
- `POST /api/posts`, `GET /api/posts/feed`, `GET /api/posts/{id}`, `PATCH /api/posts/{id}`, `DELETE /api/posts/{id}`
- `POST` et `DELETE /api/posts/{id}/like`, `GET /api/posts/{id}/likes`
- `GET` et `POST /api/posts/{id}/comments`, `DELETE /api/posts/{id}/comments/{comment_id}`
- `GET /api/notifications`, `POST /api/notifications/read`
- `PUT` et `DELETE /api/users/me/alert-token`. Le corps nomme le genre. Retirer vise le jeton de cet appareil.
- `POST` et `DELETE /api/users/{username}/block`
- `POST /api/users/{username}/report`, `POST /api/posts/{id}/report`

Le fil et la grille demandent 12 publications, 30 au plus, les plus anciennes avec `before`. Les commentaires demandent 30, 50 au plus, les plus anciens d’abord, avec `after`. Les notifications demandent 20, 50 au plus, les plus récentes d’abord, avec `before`.

## Client

En haut à gauche : la grue, qui ouvre le fil. En haut à droite : la cloche et publier. Ce bandeau reste visible quand les publications défilent. Barre du bas : recherche, profil. Les fonds sont blancs. Sur son profil, une roue crantée en haut à gauche ouvre les réglages : modifier le profil, demandes reçues, alertes, données, quitter la session. Modifier le profil change le nom affiché, la bio et l’avatar. Accepter les alertes demande l’autorisation du système, sur iOS, Android et le web. Sur iPhone, le site ne les reçoit qu’une fois ajouté à l’écran d’accueil. Le profil d’un autre n’a pas cette roue. La page du profil, la sienne comme celle d’un autre, a la même disposition. Sur le profil comme sur la fiche, le nom d’utilisateur est au-dessus des trois compteurs, à droite de l’avatar. Ces compteurs sont à droite de l’avatar, dans cet ordre : publications, abonnés, abonnements. Le nom affiché et la bio restent en dessous. Le compteur de publications donne le nombre de publications, pas le nombre de photos, et n’ouvre pas de liste. Les compteurs d’abonnés et d’abonnements ouvrent les listes. L’écran de connexion montre la grue, au centre. Écrans en plus : connexion, choix du nom, commentaires, j’aime, listes d’abonnés et d’abonnements, demandes reçues, signalement, blocage, explication des données. Pas d’écran d’inscription. Le web est l’export Expo.

## Hébergement

L’API, Postgres et le site tournent sur l’hôte déjà choisi. Les images n’y sont pas stockées. Elles vont dans un bucket Scaleway privé, en France, classe standard multi-zones. Le navigateur du site peut y lire un objet, en GET seulement, pour garder le fichier. Le dépôt ne décrit que ce bucket. GitHub l’applique, depuis un workflow. Le nom du bucket, l’identifiant de projet, les clés et les origines de cette lecture sont des secrets de ce workflow. L’état Terraform est hors du dépôt, dans le stockage d’objets. `terraform validate` tourne dans ce workflow, sans apply et sans secret, seulement quand `infra/` ou ce workflow change. Une pull request ne fait que cette validation. Le déploiement du site n’attend pas cet apply.

L’image contient le binaire Go et l’export web. Elle écoute sur le port 8000. `/api` est l’API. Le reste sert un fichier s’il existe, sinon la page de l’export. Le site et l’API sont sur deux origines. L’origine du site sert l’export. L’origine de l’API ne répond qu’à `/api`. La porte devant le processus fait ce partage et n’est pas dans le dépôt. L’adresse de l’API est reprise dans l’image au moment de la construction. Cette spec ne nomme ni l’hôte, ni ces origines, ni un registre.

Mettre l’image sur l’hôte fait partie du produit. Sur `main`, une fois les contrôles passés, les sources sont copiées sur l’hôte et l’image y est construite. Le processus lit son environnement sur place. Ce fichier n’est pas copié.

## Configuration

Les exemples du dépôt sont vides. Les valeurs sont hors du dépôt.

L’API lit `DATABASE_URL`, `ISSUER_URL`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `WEB_ROOT`, `CORS_ORIGINS`. Elle ne lit pas le fichier toute seule. `WEB_ROOT` est le dossier de l’export dans l’image, vide sans site. `CORS_ORIGINS` liste les origines du site, séparées par des virgules.

Le client lit `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ISSUER_URL`, `EXPO_PUBLIC_CLIENT_ID`. Sans adresse d’API, les appels du site restent sur le même site. En production, l’adresse d’API est celle du site d’API, prise à la construction de l’image. L’adresse de l’issuer et l’identifiant de client sont pris au même moment. Pour le téléphone, l’adresse d’API, l’issuer et l’identifiant de client viennent des secrets du workflow manuel. `EXPO_OWNER` et `EXPO_PROJECT_ID` identifient le projet de build. `EXPO_TOKEN` l’autorise. `EXPO_ASC_APP_ID` n’est exigé que pour soumettre iOS. Le compte de service Android est lié dans EAS. Aucune de ces valeurs n’est dans le dépôt.

L’envoi iOS lit `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY`. Le sujet est `app.instacrane`. L’envoi Android lit `FCM_CREDENTIALS`. L’envoi web lit `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. La clé publique est la seule que le navigateur reçoit. Aucune de ces valeurs n’est dans le dépôt. S’il en manque une, ce genre d’alerte n’est pas envoyé.

Le client chez l’issuer est public, sans secret, et il n’est pas sur invitation. Il ne demande pas lui-même l’inscription : l’écran de connexion de l’issuer propose le formulaire. Il reconnaît trois retours : le web local, `instacrane://redirect` sur le téléphone, et le site public. Le chemin est `/redirect`. Sur le web, la connexion reste dans le même onglet. Avant de partir, l’app garde le vérificateur et l’état dans le navigateur. Au retour, elle échange le code une seule fois, retire le code et l’état de l’adresse, puis ouvre le fil, ou l’écran du nom s’il manque. L’écran de retour montre l’attente. Si le vérificateur manque ou si l’échange échoue, elle revient à la connexion et dit pourquoi. Le navigateur doit pouvoir terminer l’échange avec l’issuer depuis l’origine du site.

En local, `docker compose` lance Postgres et l’API. Postgres n’écoute que sur la machine. Les tests d’images passent par MinIO, lancé à part.

## Intégration continue

À chaque poussée et à chaque pull request, les contrôles tournent sans secret :

- les tests Go, Postgres 16 et MinIO
- la construction de l’image, sans registre
- les tests du client : la configuration se charge, les identifiants restent `app.instacrane`, le schéma reste `instacrane`, aucun compte Apple, Google ou Expo dans le dépôt

Sur `main`, le déploiement lit `DEPLOY_SSH_KEY`, `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PATH`. Aucune de ces valeurs n’est dans le dépôt.

Un workflow manuel lance les builds téléphone. Il ne part ni à la poussée ni à la pull request. Deux cases : soumettre iOS vers TestFlight, soumettre Android vers la piste interne. Aucune case : build iOS seul, sans soumission. La case Android seule construit Android et le soumet, sans build iOS. Les deux cases construisent les deux et les soumettent. Android n’est pas construit sans sa soumission.

Ce workflow lit `EXPO_TOKEN`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ISSUER_URL`, `EXPO_PROJECT_ID`. `EXPO_PUBLIC_CLIENT_ID` et `EXPO_OWNER` s’y ajoutent. `EXPO_ASC_APP_ID` est exigé quand la case iOS est cochée.

Renovate surveille les bibliothèques. Une zéro-day est prise le jour du correctif. Un correctif ou une mineure, sans faille, est fusionné dès que la CI passe. Une majeure, ou une faille qui n’est pas une zéro-day, attend 30 jours.

## Hors périmètre

Déménager l’API hors de son hôte. Stories, messages, explore, republication, comptes publics, vidéos. Changer le nom d’utilisateur. Remonter un signalement vers l’issuer. Un écran d’inscription dans l’application.

## Découpage

Une tranche à la fois. Un écart vu après une tranche fermée suit le même ordre, en plus court. La règle est d’abord ajoutée ici, puis un plan dans ce dossier. Le changement vient ensuite. On ne le commit pas sans ce plan.

1. Socle. Migrations, `GET /api/health`.
2. Auth. Session, profil, email, nom d’utilisateur.
3. Profils. Édition, avatar, fiche, recherche, demandes, compteurs, listes.
4. Publications. Photos, fil, détail, likes, commentaires, liens signés.
5. Notifications. Les trois cas, la cloche, le jeton d’alerte.
6. Signalement et blocage.
7. Client Expo. Les écrans.
8. Bascule. L’image Go, la CI, le Terraform du bucket.
9. Stores. Configuration de build, sans identifiant de compte dans le dépôt.
10. Mise en service. L’image sur l’hôte, le retour du site chez l’issuer, et le workflow manuel des builds téléphone.
11. Tête du profil. Nom d’utilisateur au-dessus, compteur de publications.
12. Roue crantée. Réglages du sien, fiche inchangée pour les autres.
13. Publication dans le fil. Plus d’écran de détail, commentaires à part.
14. Qui a aimé. La page ouverte par le nombre de likes.
15. Recherche. Bio et légende, pas les commentaires.
16. Export. Un zip des données du compte, depuis l’écran des données.
17. Alertes. iOS, Android et le web, un jeton par appareil.
