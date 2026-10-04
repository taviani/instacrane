package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taviani/instacrane/server/internal/auth"
)

type Deps struct {
	Pool     *pgxpool.Pool
	Sessions *auth.Verifier
}

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9_.]{3,30}$`)

type profile struct {
	Sub         string    `json:"sub"`
	Email       *string   `json:"email"`
	Username    *string   `json:"username"`
	DisplayName *string   `json:"display_name"`
	Bio         *string   `json:"bio"`
	AvatarKey   *string   `json:"avatar_key"`
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
		writeJSON(w, http.StatusOK, found)
	})
	mux.HandleFunc("PATCH /api/users/me", func(w http.ResponseWriter, r *http.Request) {
		session, ok := deps.session(w, r)
		if !ok {
			return
		}
		username, ok := patchUsername(w, r)
		if !ok {
			return
		}
		row := deps.Pool.QueryRow(r.Context(), `
			UPDATE users
			SET username = $2
			WHERE sub = $1 AND username IS NULL
			RETURNING sub, email, username, display_name, bio, avatar_key, created_at
		`, session.Sub, username)
		found, err := scanProfile(row)
		if err == nil {
			writeJSON(w, http.StatusOK, found)
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
		var exists bool
		if err := deps.Pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM users WHERE sub = $1)`, session.Sub).Scan(&exists); err != nil {
			writeError(w, http.StatusInternalServerError, "profil indisponible")
			return
		}
		if !exists {
			writeError(w, http.StatusNotFound, "profil absent")
			return
		}
		writeError(w, http.StatusConflict, "nom déjà choisi")
	})
	return mux
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

func patchUsername(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		Username *string `json:"username"`
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
	if body.Username == nil {
		writeError(w, http.StatusBadRequest, "nom invalide")
		return "", false
	}
	username := strings.TrimSpace(*body.Username)
	if !usernamePattern.MatchString(username) {
		writeError(w, http.StatusBadRequest, "nom invalide")
		return "", false
	}
	return username, true
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
