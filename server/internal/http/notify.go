package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const maxAlertToken = 4096

type noteActor struct {
	Username    *string `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type noteItem struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
	IsRead    bool      `json:"is_read"`
	PostID    *string   `json:"post_id"`
	Actor     noteActor `json:"actor"`
}

func (deps Deps) listNotifications(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	limit, beforeAt, beforeID, ok := notePage(w, r)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT n.id, n.type, n.created_at, n.is_read, n.post_id,
		       u.username, u.display_name, u.avatar_key
		FROM notifications n
		JOIN users u ON u.sub = n.actor_sub
		WHERE n.recipient_sub = $1
		  AND ($2::timestamptz IS NULL OR (n.created_at, n.id) < ($2, $3::uuid))
		ORDER BY n.created_at DESC, n.id DESC
		LIMIT $4
	`, session.Sub, beforeAt, beforeID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "notification indisponible")
		return
	}
	defer rows.Close()
	items := []noteItem{}
	for rows.Next() {
		var item noteItem
		var key *string
		if err := rows.Scan(
			&item.ID, &item.Type, &item.CreatedAt, &item.IsRead, &item.PostID,
			&item.Actor.Username, &item.Actor.DisplayName, &key,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "notification indisponible")
			return
		}
		item.Actor.AvatarURL, err = deps.signed(r.Context(), key)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "notification indisponible")
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "notification indisponible")
		return
	}
	var bell bool
	if err := deps.Pool.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM notifications WHERE recipient_sub = $1 AND NOT is_read
		) OR EXISTS (
			SELECT 1 FROM follows WHERE following_sub = $1 AND status = 'pending'
		)
	`, session.Sub).Scan(&bell); err != nil {
		writeError(w, http.StatusInternalServerError, "notification indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bell": bell, "notifications": items})
}

func (deps Deps) readNotifications(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `
		UPDATE notifications SET is_read = true
		WHERE recipient_sub = $1 AND NOT is_read
	`, session.Sub); err != nil {
		writeError(w, http.StatusInternalServerError, "notification indisponible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) putAlertToken(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	token, ok := alertToken(w, r)
	if !ok {
		return
	}
	var exists bool
	if err := deps.Pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM users WHERE sub = $1)`, session.Sub).Scan(&exists); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "profil absent")
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `
		INSERT INTO push_tokens (user_sub, token) VALUES ($1, $2)
		ON CONFLICT (user_sub) DO UPDATE SET token = EXCLUDED.token
	`, session.Sub, token); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			writeError(w, http.StatusNotFound, "profil absent")
			return
		}
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) deleteAlertToken(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `DELETE FROM push_tokens WHERE user_sub = $1`, session.Sub); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) alert(ctx context.Context, recipient, actor, kind string) {
	if deps.Alerts == nil {
		return
	}
	var token string
	err := deps.Pool.QueryRow(ctx, `SELECT token FROM push_tokens WHERE user_sub = $1`, recipient).Scan(&token)
	if err != nil || token == "" {
		return
	}
	var username *string
	if err := deps.Pool.QueryRow(ctx, `SELECT username FROM users WHERE sub = $1`, actor).Scan(&username); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return
	}
	_ = deps.Alerts.Send(ctx, token, alertText(kind, username))
}

func alertText(kind string, username *string) string {
	who := "Quelqu'un"
	if username != nil && *username != "" {
		who = *username
	}
	switch kind {
	case "like":
		return who + " a aimé une publication"
	case "comment":
		return who + " a commenté une publication"
	default:
		return who + " a demandé à vous suivre"
	}
}

func notePage(w http.ResponseWriter, r *http.Request) (int, *time.Time, *string, bool) {
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := parseLimit(raw, 50)
		if err != nil {
			writeError(w, http.StatusBadRequest, "page invalide")
			return 0, nil, nil, false
		}
		limit = n
	}
	raw := r.URL.Query().Get("before")
	if raw == "" {
		return limit, nil, nil, true
	}
	atRaw, id, ok := strings.Cut(raw, "|")
	at, err := time.Parse(time.RFC3339Nano, atRaw)
	if !ok || err != nil || !uuidPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "page invalide")
		return 0, nil, nil, false
	}
	return limit, &at, &id, true
}

func alertToken(w http.ResponseWriter, r *http.Request) (string, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	var body struct {
		Token *string `json:"token"`
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return "", false
	}
	var extra struct{}
	if err := dec.Decode(&extra); err != io.EOF {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return "", false
	}
	if body.Token == nil {
		writeError(w, http.StatusBadRequest, "jeton invalide")
		return "", false
	}
	token := strings.TrimSpace(*body.Token)
	if token == "" || len(token) > maxAlertToken {
		writeError(w, http.StatusBadRequest, "jeton invalide")
		return "", false
	}
	return token, true
}
