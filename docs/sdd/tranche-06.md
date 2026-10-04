# Tranche 6 — signalement et blocage

Plan d’implémentation. Le produit reste celui de `spec.md`. On ne code pas la tranche suivante.

## Fait quand

- Depuis un profil, on signale le compte ou on le bloque. Depuis une publication qu’on peut voir, on la signale. Le signalement d’un compte contient la personne qui signale, la personne signalée, et le moment. Le signalement d’une publication contient la personne qui signale, la publication, et le moment. Pas de motif, pas d’email, pas de légende, pas de texte de commentaire.
- Le signaler une nouvelle fois crée une autre ligne, avec son propre moment. Personne n’est prévenu. Rien n’est envoyé à l’issuer.
- Bloquer retire le suivi de la personne bloquée vers celui qui bloque, en attente ou déjà accepté. Elle ne peut plus redemander. Le suivi inverse reste.
- Elle ne voit plus ses photos : grille vide, fil sans elles, détail introuvable, like et commentaire introuvables. Lui continue de voir les siennes s’il les voyait déjà, et il peut encore aimer ou commenter.
- Débloquer retire seulement cette interdiction. L’ancien suivi ne revient pas. Elle peut redemander. S’il l’accepte, l’accès revient. Si elle l’a bloqué aussi, son blocage à elle reste.
- La fiche du profil reste visible : nom, avatar, bio. Elle indique le blocage à celui qui l’a posé, pas à l’autre. La recherche continue de trouver le compte.
- Les likes, commentaires et notifications déjà écrits restent. Le blocage et le signalement n’en créent pas.
- Se bloquer ou se signaler soi-même est refusé. Signaler sa propre publication aussi. Sans nom d’utilisateur, bloquer ou signaler est refusé.
- `DELETE /api/users/me` retire les blocages et les signalements avec le profil, comme les clés étrangères le prévoient déjà.
- Tout appel sauf `GET /api/health` exige une session valide. Les requêtes vers la base restent paramétrées. Les entrées sont validées avant l’écriture.
- `go test` passe, avec l’issuer de test.
- `frontend/`, `backend/`, `infra/` et `docker-compose.yml` sont inchangés.

## Virginie et Paul

Paul a accepté la demande de Virginie. Elle voit ses photos. Paul suit aussi Virginie : il voit les siennes. Paul la bloque.

Le suivi de Virginie vers Paul disparaît. Elle ne voit plus ses photos. Une nouvelle demande vers Paul est refusée, sans dire qu’elle est bloquée. Le suivi de Paul vers Virginie reste : il voit toujours ses photos, et il peut encore les aimer ou les commenter.

La fiche de Paul reste ouverte pour Virginie : son nom, son avatar, sa bio. Rien n’y dit qu’elle est bloquée. Paul, sur la fiche de Virginie, voit que le blocage est le sien. Il la débloque. Elle peut redemander. Tant qu’il n’a pas accepté, les photos ne reviennent pas.

Virginie signale le compte de Paul. La ligne contient Virginie, Paul, et le moment. Elle le signale encore : une seconde ligne, un autre moment. Elle signale une publication qu’elle peut voir : la ligne contient cette publication, pas Paul en plus. Rien de tout cela ne crée une notification, ni une alerte.

## Ce qui reste

Un like, un commentaire ou une notification déjà écrit reste, des deux côtés. L’auteur de la publication peut encore effacer un commentaire reçu. Une demande en attente de Virginie vers Paul part avec le blocage. Une notification déjà créée pour cette demande reste, même si la demande n’est plus là.

Un compte supprimé emporte ses blocages, et les signalements dont il est l’auteur ou la cible. Une publication supprimée emporte les signalements qui la visent.

## Où

On étend `server/`. Les tables `blocks` et `reports` existent déjà. Pas de migration, sauf si un essai montre qu’une contrainte manque.

```
server/
  internal/http/    blocage, déblocage, signalement
                    le blocage ferme, pour la personne bloquée,
                    le fil, la grille, le détail, le like,
                    le commentaire et les nouvelles demandes
```

Chaque ligne de blocage ferme un seul sens : la personne bloquée ne voit plus celui qui bloque. Les publications de soi restent visibles. Le sens inverse ne change pas.

## Routes

Toutes exigent une session, et un nom d’utilisateur.

- `POST /api/users/{username}/block` : pose le blocage et retire le suivi de ce compte vers l’appelant. Un second appel ne crée pas une seconde ligne. Se bloquer soi-même est refusé. Un corps avec un champ est refusé.
- `DELETE /api/users/{username}/block` : retire le blocage posé par ce compte. S’il n’y en a pas, l’appel répond introuvable. Ça ne retire pas le blocage posé par l’autre, ni ne recrée le suivi.
- `POST /api/users/{username}/report` : signale le compte. Le compte inconnu répond introuvable. Se signaler est refusé. Un champ dans le corps est refusé : il n’y a pas de motif à garder.
- `POST /api/posts/{id}/report` : signale la publication, si on peut la voir. Sinon elle est introuvable. Signaler la sienne est refusé.

`GET /api/users/{username}` gagne un indicateur, vrai seulement quand c’est l’appelant qui a bloqué ce compte. Il n’existe pas de liste des signalements, ni de liste des comptes bloqués.

## On ne fait pas

L’écran de signalement, l’écran de blocage, le motif, la file de modération, la remontée vers l’issuer, le compteur de vues, la recommandation, le client, Renovate.
