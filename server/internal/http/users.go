package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taviani/instacrane/server/internal/auth"
)

type Objects interface {
	PutAvatar(ctx context.Context, body []byte) (string, error)
	PutPhoto(ctx context.Context, display, thumb []byte) (string, string, error)
	Delete(ctx context.Context, key string) error
	Sign(ctx context.Context, key string) (string, error)
}

type Alerter interface {
	Send(ctx context.Context, token, text string) error
}

type Deps struct {
	Pool     *pgxpool.Pool
	Sessions *auth.Verifier
	Objects  Objects
	Alerts   Alerter
}

var (
	usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_.]{3,30}$`)
	uuidPattern     = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

type profile struct {
	Sub         string    `json:"sub"`
	Email       *string   `json:"email"`
	Username    *string   `json:"username"`
	DisplayName *string   `json:"display_name"`
	Bio         *string   `json:"bio"`
	AvatarKey   *string   `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
}

type ownerView struct {
	Sub         string    `json:"sub"`
	Email       *string   `json:"email"`
	Username    *string   `json:"username"`
	DisplayName *string   `json:"display_name"`
	Bio         *string   `json:"bio"`
	AvatarURL   *string   `json:"avatar_url"`
	CreatedAt   time.Time `json:"created_at"`
}

func New(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /api/users/me", func(w http.ResponseWriter, r *http.Request) {
		session, ok := deps.session(w, r)
		if !ok {
			return
		}
		row := deps.Pool.QueryRow(r.Context(), `
			INSERT INTO users (sub, email)
			VALUES ($1, $2)
			ON CONFLICT (sub) DO UPDATE
			SET email = COALESCE(EXCLUDED.email, users.email)
			RETURNING sub, email, username, display_name, bio, avatar_key, created_at
		`, session.Sub, session.Email)
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
	})
	mux.HandleFunc("PATCH /api/users/me", deps.patchMe)
	mux.HandleFunc("DELETE /api/users/me", deps.deleteMe)
	mux.HandleFunc("POST /api/users/me/avatar", deps.postAvatar)
	mux.HandleFunc("POST /api/posts", deps.createPost)
	mux.HandleFunc("GET /api/posts/feed", deps.feed)
	mux.HandleFunc("GET /api/posts/{id}", deps.postDetail)
	mux.HandleFunc("DELETE /api/posts/{id}", deps.deletePost)
	mux.HandleFunc("POST /api/posts/{id}/like", deps.likePost)
	mux.HandleFunc("DELETE /api/posts/{id}/like", deps.unlikePost)
	mux.HandleFunc("GET /api/posts/{id}/comments", deps.listComments)
	mux.HandleFunc("POST /api/posts/{id}/comments", deps.createComment)
	mux.HandleFunc("DELETE /api/posts/{id}/comments/{comment_id}", deps.deleteComment)
	mux.HandleFunc("GET /api/users/me/follow-requests", deps.followRequests)
	mux.HandleFunc("GET /api/users/{username}", deps.publicProfile)
	mux.HandleFunc("GET /api/users/{username}/{kind}", deps.userCollection)
	mux.HandleFunc("POST /api/users/{username}/follow", deps.requestFollow)
	mux.HandleFunc("DELETE /api/users/{username}/follow", deps.cancelFollow)
	mux.HandleFunc("POST /api/users/{username}/follow/accept", deps.acceptFollow)
	mux.HandleFunc("DELETE /api/users/{username}/follow/request", deps.refuseFollow)
	mux.HandleFunc("GET /api/notifications", deps.listNotifications)
	mux.HandleFunc("POST /api/notifications/read", deps.readNotifications)
	mux.HandleFunc("PUT /api/users/me/alert-token", deps.putAlertToken)
	mux.HandleFunc("DELETE /api/users/me/alert-token", deps.deleteAlertToken)
	return mux
}

func (deps Deps) patchMe(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	change, ok := patchProfile(w, r)
	if !ok {
		return
	}
	row := deps.Pool.QueryRow(r.Context(), `
		UPDATE users
		SET username = CASE WHEN $2 THEN $3 ELSE username END,
		    display_name = CASE WHEN $4 THEN $5 ELSE display_name END,
		    bio = CASE WHEN $6 THEN $7 ELSE bio END
		WHERE sub = $1
		  AND (NOT $2 OR username IS NULL)
		RETURNING sub, email, username, display_name, bio, avatar_key, created_at
	`, session.Sub, change.setUsername, change.username, change.setDisplay, change.displayName, change.setBio, change.bio)
	found, err := scanProfile(row)
	if err == nil {
		view, viewErr := deps.ownerView(r.Context(), found)
		if viewErr != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		writeJSON(w, http.StatusOK, view)
		return
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		writeError(w, http.StatusConflict, "nom déjà pris")
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	var current *string
	if err := deps.Pool.QueryRow(r.Context(), `SELECT username FROM users WHERE sub = $1`, session.Sub).Scan(&current); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "profil absent")
			return
		}
		writeError(w, http.StatusInternalServerError, "profil indisponible")
		return
	}
	writeError(w, http.StatusConflict, "nom déjà choisi")
}

func (deps Deps) session(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	raw, ok := bearer(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "session manquante")
		return auth.Session{}, false
	}
	session, err := deps.Sessions.Verify(r.Context(), raw)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "session refusée")
		return auth.Session{}, false
	}
	return session, true
}

func bearer(r *http.Request) (string, bool) {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	const prefix = "Bearer "
	if len(value) < len(prefix) || !strings.EqualFold(value[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(value[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}

type profileChange struct {
	setUsername bool
	username    *string
	setDisplay  bool
	displayName *string
	setBio      bool
	bio         *string
}

func patchProfile(w http.ResponseWriter, r *http.Request) (profileChange, bool) {
	var body struct {
		Username    *string `json:"username"`
		DisplayName *string `json:"display_name"`
		Bio         *string `json:"bio"`
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return profileChange{}, false
	}
	var extra struct{}
	if err := dec.Decode(&extra); err != io.EOF {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return profileChange{}, false
	}
	if body.Username == nil && body.DisplayName == nil && body.Bio == nil {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return profileChange{}, false
	}
	change := profileChange{}
	if body.Username != nil {
		username := strings.TrimSpace(*body.Username)
		if !usernamePattern.MatchString(username) || username == "me" || username == "search" {
			writeError(w, http.StatusBadRequest, "nom invalide")
			return profileChange{}, false
		}
		change.setUsername = true
		change.username = &username
	}
	if body.DisplayName != nil {
		name, ok := boundedText(w, *body.DisplayName, 80, "nom affiché invalide")
		if !ok {
			return profileChange{}, false
		}
		change.setDisplay = true
		change.displayName = name
	}
	if body.Bio != nil {
		bio, ok := boundedText(w, *body.Bio, 300, "bio invalide")
		if !ok {
			return profileChange{}, false
		}
		change.setBio = true
		change.bio = bio
	}
	return change, true
}

func boundedText(w http.ResponseWriter, value string, max int, message string) (*string, bool) {
	value = strings.TrimSpace(value)
	if utf8.RuneCountInString(value) > max {
		writeError(w, http.StatusBadRequest, message)
		return nil, false
	}
	if value == "" {
		return nil, true
	}
	return &value, true
}

func (deps Deps) ownerView(ctx context.Context, found profile) (ownerView, error) {
	avatar, err := deps.signed(ctx, found.AvatarKey)
	if err != nil {
		return ownerView{}, err
	}
	return ownerView{
		Sub:         found.Sub,
		Email:       found.Email,
		Username:    found.Username,
		DisplayName: found.DisplayName,
		Bio:         found.Bio,
		AvatarURL:   avatar,
		CreatedAt:   found.CreatedAt,
	}, nil
}

func (deps Deps) signed(ctx context.Context, key *string) (*string, error) {
	if key == nil || *key == "" {
		return nil, nil
	}
	if deps.Objects == nil {
		return nil, errors.New("stockage absent")
	}
	link, err := deps.Objects.Sign(ctx, *key)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

func scanProfile(row pgx.Row) (profile, error) {
	var found profile
	err := row.Scan(&found.Sub, &found.Email, &found.Username, &found.DisplayName, &found.Bio, &found.AvatarKey, &found.CreatedAt)
	return found, err
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
