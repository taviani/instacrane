package api

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (deps Deps) deleteMe(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	var avatar *string
	err := deps.Pool.QueryRow(r.Context(), `SELECT avatar_key FROM users WHERE sub = $1`, session.Sub).Scan(&avatar)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profil absent")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT pp.display_key, pp.thumbnail_key
		FROM post_photos pp
		JOIN posts p ON p.id = pp.post_id
		WHERE p.author_sub = $1
	`, session.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer rows.Close()
	var keys []string
	if avatar != nil && *avatar != "" {
		keys = append(keys, *avatar)
	}
	for rows.Next() {
		var display, thumb string
		if err := rows.Scan(&display, &thumb); err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		keys = append(keys, display, thumb)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if err := deps.removeKeys(r.Context(), keys); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `DELETE FROM users WHERE sub = $1`, session.Sub); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
