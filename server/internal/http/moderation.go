package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/taviani/instacrane/server/internal/auth"
)

func (deps Deps) blockUser(w http.ResponseWriter, r *http.Request) {
	actor, target, ok := deps.namedPair(w, r)
	if !ok {
		return
	}
	if target == actor {
		writeError(w, http.StatusBadRequest, "blocage refusé")
		return
	}
	tx, err := deps.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer tx.Rollback(r.Context())
	tag, err := tx.Exec(r.Context(), `
		INSERT INTO blocks (blocker_sub, blocked_sub) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, actor, target)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if _, err := tx.Exec(r.Context(), `
		DELETE FROM follows WHERE follower_sub = $1 AND following_sub = $2
	`, target, actor); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	code := http.StatusOK
	if tag.RowsAffected() == 1 {
		code = http.StatusCreated
	}
	writeJSON(w, code, map[string]bool{"blocked": true})
}

func (deps Deps) unblockUser(w http.ResponseWriter, r *http.Request) {
	actor, target, ok := deps.namedPair(w, r)
	if !ok {
		return
	}
	tag, err := deps.Pool.Exec(r.Context(), `
		DELETE FROM blocks WHERE blocker_sub = $1 AND blocked_sub = $2
	`, actor, target)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "blocage introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) reportUser(w http.ResponseWriter, r *http.Request) {
	actor, target, ok := deps.namedPair(w, r)
	if !ok {
		return
	}
	if target == actor {
		writeError(w, http.StatusBadRequest, "signalement refusé")
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `
		INSERT INTO reports (reporter_sub, target_user_sub) VALUES ($1, $2)
	`, actor, target); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (deps Deps) reportPost(w http.ResponseWriter, r *http.Request) {
	actor, name, ok := deps.actor(w, r)
	if !ok {
		return
	}
	if auth.ActionRefused(name) {
		writeError(w, http.StatusForbidden, "nom requis")
		return
	}
	if !emptyBody(w, r) {
		return
	}
	id := r.PathValue("id")
	if _, err := deps.readPost(r.Context(), actor, id, false); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "publication introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	var author string
	if err := deps.Pool.QueryRow(r.Context(), `SELECT author_sub FROM posts WHERE id = $1`, id).Scan(&author); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if author == actor {
		writeError(w, http.StatusBadRequest, "signalement refusé")
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `
		INSERT INTO reports (reporter_sub, target_post_id) VALUES ($1, $2)
	`, actor, id); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (deps Deps) namedPair(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	actor, name, ok := deps.actor(w, r)
	if !ok {
		return "", "", false
	}
	if auth.ActionRefused(name) {
		writeError(w, http.StatusForbidden, "nom requis")
		return "", "", false
	}
	if !emptyBody(w, r) {
		return "", "", false
	}
	target, ok := deps.userByName(w, r)
	if !ok {
		return "", "", false
	}
	return actor, target, true
}

func emptyBody(w http.ResponseWriter, r *http.Request) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var body struct{}
	err := dec.Decode(&body)
	if err == io.EOF {
		return true
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return false
	}
	var extra struct{}
	if err := dec.Decode(&extra); err != io.EOF {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return false
	}
	return true
}
