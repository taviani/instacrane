package api

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/taviani/instacrane/server/internal/auth"
)

func (deps Deps) requestFollow(w http.ResponseWriter, r *http.Request) {
	actor, name, ok := deps.actor(w, r)
	if !ok {
		return
	}
	if auth.ActionRefused(name) {
		writeError(w, http.StatusForbidden, "nom requis")
		return
	}
	target, ok := deps.userByName(w, r)
	if !ok {
		return
	}
	if target == actor {
		writeError(w, http.StatusBadRequest, "demande refusée")
		return
	}
	var blocked bool
	if err := deps.Pool.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM blocks WHERE blocker_sub = $1 AND blocked_sub = $2
		)
	`, target, actor).Scan(&blocked); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if blocked {
		writeError(w, http.StatusBadRequest, "demande refusée")
		return
	}
	tx, err := deps.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer tx.Rollback(r.Context())
	tag, err := tx.Exec(r.Context(), `
		INSERT INTO follows (follower_sub, following_sub, status)
		VALUES ($1, $2, 'pending')
		ON CONFLICT DO NOTHING
	`, actor, target)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	var status string
	if err := tx.QueryRow(r.Context(), `
		SELECT status FROM follows WHERE follower_sub = $1 AND following_sub = $2
	`, actor, target).Scan(&status); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if status == "accepted" {
		writeError(w, http.StatusConflict, "déjà suivi")
		return
	}
	if tag.RowsAffected() == 1 {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO notifications (recipient_sub, actor_sub, type)
			VALUES ($1, $2, 'follow')
		`, target, actor); err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if tag.RowsAffected() == 1 {
		deps.alert(r.Context(), target, actor, "follow")
	}
	code := http.StatusOK
	if tag.RowsAffected() == 1 {
		code = http.StatusCreated
	}
	writeJSON(w, code, map[string]string{"status": "pending"})
}

func (deps Deps) cancelFollow(w http.ResponseWriter, r *http.Request) {
	actor, _, ok := deps.actor(w, r)
	if !ok {
		return
	}
	target, ok := deps.userByName(w, r)
	if !ok {
		return
	}
	tag, err := deps.Pool.Exec(r.Context(), `
		DELETE FROM follows WHERE follower_sub = $1 AND following_sub = $2
	`, actor, target)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "demande absente")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) acceptFollow(w http.ResponseWriter, r *http.Request) {
	deps.answerFollow(w, r, true)
}

func (deps Deps) refuseFollow(w http.ResponseWriter, r *http.Request) {
	deps.answerFollow(w, r, false)
}

func (deps Deps) answerFollow(w http.ResponseWriter, r *http.Request, accept bool) {
	actor, _, ok := deps.actor(w, r)
	if !ok {
		return
	}
	requester, ok := deps.userByName(w, r)
	if !ok {
		return
	}
	if accept {
		tag, err := deps.Pool.Exec(r.Context(), `
			UPDATE follows SET status = 'accepted'
			WHERE follower_sub = $1 AND following_sub = $2 AND status = 'pending'
		`, requester, actor)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		if tag.RowsAffected() == 0 {
			writeError(w, http.StatusNotFound, "demande absente")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
		return
	}
	tag, err := deps.Pool.Exec(r.Context(), `
		DELETE FROM follows
		WHERE follower_sub = $1 AND following_sub = $2 AND status = 'pending'
	`, requester, actor)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "demande absente")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) followRequests(w http.ResponseWriter, r *http.Request) {
	actor, _, ok := deps.actor(w, r)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT u.username, u.display_name, u.bio, u.avatar_key
		FROM follows f
		JOIN users u ON u.sub = f.follower_sub
		WHERE f.following_sub = $1 AND f.status = 'pending' AND u.username IS NOT NULL
		ORDER BY u.username
		LIMIT 100
	`, actor)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer rows.Close()
	cards, err := deps.cards(r, rows)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": cards})
}

func (deps Deps) actor(w http.ResponseWriter, r *http.Request) (string, *string, bool) {
	session, ok := deps.session(w, r)
	if !ok {
		return "", nil, false
	}
	var username *string
	err := deps.Pool.QueryRow(r.Context(), `SELECT username FROM users WHERE sub = $1`, session.Sub).Scan(&username)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profil absent")
		return "", nil, false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return "", nil, false
	}
	return session.Sub, username, true
}
