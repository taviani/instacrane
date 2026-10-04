package api

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/taviani/instacrane/server/internal/media"
)

const maxAvatarBytes = 15 << 20

type person struct {
	Username      string  `json:"username"`
	DisplayName   *string `json:"display_name"`
	Bio           *string `json:"bio"`
	AvatarURL     *string `json:"avatar_url"`
	FollowRequest string  `json:"follow_request,omitempty"`
}

type publicCard struct {
	person
	FollowersCount int  `json:"followers_count"`
	FollowingCount int  `json:"following_count"`
	Blocked        bool `json:"blocked"`
}

func (deps Deps) postAvatar(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	if deps.Objects == nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBytes)
	if err := r.ParseMultipartForm(maxAvatarBytes); err != nil {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return
	}
	defer file.Close()
	raw, err := io.ReadAll(io.LimitReader(file, maxAvatarBytes+1))
	if err != nil || len(raw) == 0 || len(raw) > maxAvatarBytes {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return
	}
	jpeg, err := media.AvatarJPEG(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return
	}
	key, err := deps.Objects.PutAvatar(r.Context(), jpeg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	var previous *string
	err = deps.Pool.QueryRow(r.Context(), `
		WITH previous AS (
			SELECT avatar_key FROM users WHERE sub = $1
		)
		UPDATE users AS u
		SET avatar_key = $2
		FROM previous
		WHERE u.sub = $1
		RETURNING previous.avatar_key
	`, session.Sub, key).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = deps.Objects.Delete(r.Context(), key)
		writeError(w, http.StatusNotFound, "profil absent")
		return
	}
	if err != nil {
		_ = deps.Objects.Delete(r.Context(), key)
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if previous != nil && *previous != key {
		_ = deps.Objects.Delete(r.Context(), *previous)
	}
	row := deps.Pool.QueryRow(r.Context(), `
		SELECT sub, email, username, display_name, bio, avatar_key, created_at
		FROM users WHERE sub = $1
	`, session.Sub)
	found, err := scanProfile(row)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	view, err := deps.ownerView(r.Context(), found)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (deps Deps) publicProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	username := r.PathValue("username")
	if !usernamePattern.MatchString(username) {
		writeError(w, http.StatusNotFound, "profil introuvable")
		return
	}
	var card publicCard
	var key *string
	err := deps.Pool.QueryRow(r.Context(), `
		SELECT u.username, u.display_name, u.bio, u.avatar_key,
		       (SELECT count(*) FROM follows WHERE following_sub = u.sub AND status = 'accepted'),
		       (SELECT count(*) FROM follows WHERE follower_sub = u.sub AND status = 'accepted'),
		       COALESCE((SELECT status FROM follows WHERE follower_sub = $2 AND following_sub = u.sub), 'none'),
		       EXISTS (SELECT 1 FROM blocks WHERE blocker_sub = $2 AND blocked_sub = u.sub)
		FROM users u
		WHERE u.username = $1
	`, username, session.Sub).Scan(&card.Username, &card.DisplayName, &card.Bio, &key, &card.FollowersCount, &card.FollowingCount, &card.FollowRequest, &card.Blocked)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profil introuvable")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	card.AvatarURL, err = deps.signed(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeJSON(w, http.StatusOK, card)
}

func (deps Deps) userCollection(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("username") == "search" {
		deps.searchUsers(w, r)
		return
	}
	switch r.PathValue("kind") {
	case "posts":
		deps.userPosts(w, r)
	case "followers":
		deps.followers(w, r)
	case "following":
		deps.following(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (deps Deps) searchUsers(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	query := strings.TrimSpace(r.PathValue("kind"))
	if query == "" || utf8.RuneCountInString(query) > 50 {
		writeError(w, http.StatusBadRequest, "recherche invalide")
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT u.username, u.display_name, u.bio, u.avatar_key,
		       COALESCE((SELECT status FROM follows WHERE follower_sub = $2 AND following_sub = u.sub), 'none')
		FROM users u
		WHERE u.username IS NOT NULL
		  AND (
		    u.username ILIKE $1 ESCAPE '!'
		    OR u.display_name ILIKE $1 ESCAPE '!'
		  )
		ORDER BY u.username
		LIMIT 20
	`, likeContains(query), session.Sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer rows.Close()
	cards := []person{}
	for rows.Next() {
		var card person
		var key *string
		if err := rows.Scan(&card.Username, &card.DisplayName, &card.Bio, &key, &card.FollowRequest); err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		card.AvatarURL, err = deps.signed(r.Context(), key)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		cards = append(cards, card)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": cards})
}

func likeContains(value string) string {
	value = strings.ReplaceAll(value, "!", "!!")
	value = strings.ReplaceAll(value, "%", "!%")
	value = strings.ReplaceAll(value, "_", "!_")
	return "%" + value + "%"
}

type postItem struct {
	ID           string    `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	ThumbnailURL *string   `json:"thumbnail_url"`
	PhotoCount   int       `json:"photo_count"`
}

func (deps Deps) userPosts(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	author, ok := deps.userByName(w, r)
	if !ok {
		return
	}
	var visible bool
	if err := deps.Pool.QueryRow(r.Context(), `
		SELECT $1 = $2 OR (
			EXISTS (
				SELECT 1 FROM follows
				WHERE follower_sub = $1 AND following_sub = $2 AND status = 'accepted'
			)
			AND NOT EXISTS (
				SELECT 1 FROM blocks
				WHERE blocker_sub = $2 AND blocked_sub = $1
			)
		)
	`, session.Sub, author).Scan(&visible); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	if !visible {
		writeJSON(w, http.StatusOK, map[string]any{"posts": []postItem{}})
		return
	}
	limit, beforeAt, beforeID, ok := postPage(w, r)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT p.id, p.created_at,
		       (SELECT thumbnail_key FROM post_photos WHERE post_id = p.id ORDER BY position LIMIT 1),
		       (SELECT count(*) FROM post_photos WHERE post_id = p.id)
		FROM posts p
		WHERE p.author_sub = $1
		  AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2, $3::uuid))
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT $4
	`, author, beforeAt, beforeID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	defer rows.Close()
	posts := []postItem{}
	for rows.Next() {
		var item postItem
		var key *string
		if err := rows.Scan(&item.ID, &item.CreatedAt, &key, &item.PhotoCount); err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		item.ThumbnailURL, err = deps.signed(r.Context(), key)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		posts = append(posts, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func postPage(w http.ResponseWriter, r *http.Request) (int, *time.Time, *string, bool) {
	limit := 12
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := parseLimit(raw, 30)
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

func parseLimit(raw string, max int) (int, error) {
	n := 0
	for _, c := range raw {
		if c < '0' || c > '9' {
			return 0, errors.New("limit")
		}
		n = n*10 + int(c-'0')
		if n > max {
			return 0, errors.New("limit")
		}
	}
	if n < 1 {
		return 0, errors.New("limit")
	}
	return n, nil
}

func (deps Deps) followers(w http.ResponseWriter, r *http.Request) {
	deps.relationList(w, r, `
		SELECT u.username, u.display_name, u.bio, u.avatar_key
		FROM follows f
		JOIN users u ON u.sub = f.follower_sub
		WHERE f.following_sub = $1 AND f.status = 'accepted' AND u.username IS NOT NULL
		ORDER BY u.username
		LIMIT 100
	`)
}

func (deps Deps) following(w http.ResponseWriter, r *http.Request) {
	deps.relationList(w, r, `
		SELECT u.username, u.display_name, u.bio, u.avatar_key
		FROM follows f
		JOIN users u ON u.sub = f.following_sub
		WHERE f.follower_sub = $1 AND f.status = 'accepted' AND u.username IS NOT NULL
		ORDER BY u.username
		LIMIT 100
	`)
}

func (deps Deps) relationList(w http.ResponseWriter, r *http.Request, query string) {
	if _, ok := deps.session(w, r); !ok {
		return
	}
	user, ok := deps.userByName(w, r)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(r.Context(), query, user)
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

func (deps Deps) userByName(w http.ResponseWriter, r *http.Request) (string, bool) {
	username := r.PathValue("username")
	if !usernamePattern.MatchString(username) {
		writeError(w, http.StatusNotFound, "profil introuvable")
		return "", false
	}
	var sub string
	err := deps.Pool.QueryRow(r.Context(), `SELECT sub FROM users WHERE username = $1`, username).Scan(&sub)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profil introuvable")
		return "", false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return "", false
	}
	return sub, true
}
