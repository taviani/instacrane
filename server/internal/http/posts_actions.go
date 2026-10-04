package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/taviani/instacrane/server/internal/auth"
)

func (deps Deps) deletePost(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	keys, found, err := deps.postKeys(r.Context(), id, session.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	if err := deps.removeKeys(r.Context(), keys); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if _, err := deps.Pool.Exec(r.Context(), `DELETE FROM posts WHERE id = $1 AND author_sub = $2`, id, session.Sub); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) likePost(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if _, err := deps.readPost(r.Context(), session.Sub, id, false); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "publication introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	var created bool
	var recipient *string
	err := deps.Pool.QueryRow(r.Context(), `
		WITH liked AS (
			INSERT INTO likes (user_sub, post_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING
			RETURNING post_id
		), noted AS (
			INSERT INTO notifications (recipient_sub, actor_sub, type, post_id)
			SELECT p.author_sub, $1, 'like', p.id
			FROM posts p
			WHERE p.id = $2
			  AND p.author_sub <> $1
			  AND EXISTS (SELECT 1 FROM liked)
			RETURNING recipient_sub
		)
		SELECT EXISTS (SELECT 1 FROM liked), (SELECT recipient_sub FROM noted)
	`, session.Sub, id).Scan(&created, &recipient)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if recipient != nil {
		deps.alert(r.Context(), *recipient, session.Sub, "like")
	}
	var count int
	if err := deps.Pool.QueryRow(r.Context(), `SELECT count(*) FROM likes WHERE post_id = $1`, id).Scan(&count); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	code := http.StatusOK
	if created {
		code = http.StatusCreated
	}
	writeJSON(w, code, map[string]any{"liked": true, "likes_count": count})
}

func (deps Deps) unlikePost(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if _, err := deps.readPost(r.Context(), session.Sub, id, false); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "publication introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	tag, err := deps.Pool.Exec(r.Context(), `DELETE FROM likes WHERE user_sub = $1 AND post_id = $2`, session.Sub, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) listComments(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if _, err := deps.readPost(r.Context(), session.Sub, id, false); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "publication introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	limit, afterAt, afterID, ok := commentPage(w, r)
	if !ok {
		return
	}
	comments, err := deps.commentsOf(r.Context(), id, limit, afterAt, afterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (deps Deps) createComment(w http.ResponseWriter, r *http.Request) {
	actor, name, ok := deps.actor(w, r)
	if !ok {
		return
	}
	if auth.ActionRefused(name) {
		writeError(w, http.StatusForbidden, "nom requis")
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
	body, ok := commentBody(w, r)
	if !ok {
		return
	}
	var view commentView
	var recipient *string
	err := deps.Pool.QueryRow(r.Context(), `
		WITH inserted AS (
			INSERT INTO comments (author_sub, post_id, body)
			VALUES ($1, $2, $3)
			RETURNING id, author_sub, post_id, body, created_at
		), noted AS (
			INSERT INTO notifications (recipient_sub, actor_sub, type, post_id)
			SELECT p.author_sub, inserted.author_sub, 'comment', p.id
			FROM inserted
			JOIN posts p ON p.id = inserted.post_id
			WHERE p.author_sub <> inserted.author_sub
			RETURNING recipient_sub
		)
		SELECT inserted.id, u.username, u.display_name, inserted.body, inserted.created_at,
		       (SELECT recipient_sub FROM noted)
		FROM inserted
		JOIN users u ON u.sub = inserted.author_sub
	`, actor, id, body).Scan(&view.ID, &view.Username, &view.DisplayName, &view.Body, &view.CreatedAt, &recipient)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if recipient != nil {
		deps.alert(r.Context(), *recipient, actor, "comment")
	}
	writeJSON(w, http.StatusCreated, view)
}

func (deps Deps) deleteComment(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	postID := r.PathValue("id")
	commentID := r.PathValue("comment_id")
	if !uuidPattern.MatchString(postID) || !uuidPattern.MatchString(commentID) {
		writeError(w, http.StatusNotFound, "commentaire introuvable")
		return
	}
	tag, err := deps.Pool.Exec(r.Context(), `
		DELETE FROM comments AS c
		USING posts AS p
		WHERE c.id = $1 AND c.post_id = p.id AND p.id = $2
		  AND (c.author_sub = $3 OR p.author_sub = $3)
		  AND (
		    p.author_sub = $3
		    OR (
		      EXISTS (
		        SELECT 1 FROM follows
		        WHERE follower_sub = $3 AND following_sub = p.author_sub AND status = 'accepted'
		      )
		      AND NOT EXISTS (
		        SELECT 1 FROM blocks
		        WHERE blocker_sub = p.author_sub AND blocked_sub = $3
		      )
		    )
		  )
	`, commentID, postID, session.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "commentaire introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Deps) commentsOf(ctx context.Context, postID string, limit int, afterAt *time.Time, afterID *string) ([]commentView, error) {
	rows, err := deps.Pool.Query(ctx, `
		SELECT c.id, u.username, u.display_name, c.body, c.created_at
		FROM comments c
		JOIN users u ON u.sub = c.author_sub
		WHERE c.post_id = $1
		  AND ($2::timestamptz IS NULL OR (c.created_at, c.id) > ($2, $3::uuid))
		ORDER BY c.created_at ASC, c.id ASC
		LIMIT $4
	`, postID, afterAt, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	comments := []commentView{}
	for rows.Next() {
		var view commentView
		var username *string
		if err := rows.Scan(&view.ID, &username, &view.DisplayName, &view.Body, &view.CreatedAt); err != nil {
			return nil, err
		}
		if username != nil {
			view.Username = *username
		}
		comments = append(comments, view)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return comments, nil
}

func commentPage(w http.ResponseWriter, r *http.Request) (int, *time.Time, *string, bool) {
	limit := 30
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := parseLimit(raw, 50)
		if err != nil {
			writeError(w, http.StatusBadRequest, "page invalide")
			return 0, nil, nil, false
		}
		limit = n
	}
	raw := r.URL.Query().Get("after")
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

func commentBody(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		Body *string `json:"body"`
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
	if body.Body == nil {
		writeError(w, http.StatusBadRequest, "commentaire invalide")
		return "", false
	}
	text := strings.TrimSpace(*body.Body)
	if text == "" || utf8.RuneCountInString(text) > maxComment {
		writeError(w, http.StatusBadRequest, "commentaire invalide")
		return "", false
	}
	return text, true
}

func (deps Deps) postKeys(ctx context.Context, id, author string) ([]string, bool, error) {
	var found bool
	if err := deps.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM posts WHERE id = $1 AND author_sub = $2)`, id, author).Scan(&found); err != nil {
		return nil, false, err
	}
	if !found {
		return nil, false, nil
	}
	rows, err := deps.Pool.Query(ctx, `
		SELECT display_key, thumbnail_key
		FROM post_photos
		WHERE post_id = $1
	`, id)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var display, thumb string
		if err := rows.Scan(&display, &thumb); err != nil {
			return nil, false, err
		}
		keys = append(keys, display, thumb)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	return keys, true, nil
}

func (deps Deps) removeKeys(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	if deps.Objects == nil {
		return errors.New("stockage absent")
	}
	for _, key := range keys {
		if err := deps.Objects.Delete(ctx, key); err != nil {
			return err
		}
	}
	return nil
}
