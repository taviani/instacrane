package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/media"
)

const (
	maxPhotoBytes = 15 << 20
	maxPhotos     = 20
	maxCaption    = 2200
	maxComment    = 1000
)

type authorView struct {
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type photoView struct {
	Position int    `json:"position"`
	URL      string `json:"url"`
}

type commentView struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"display_name"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}

type postView struct {
	ID              string        `json:"id"`
	CreatedAt       time.Time     `json:"created_at"`
	Caption         *string       `json:"caption"`
	Latitude        *float64      `json:"latitude"`
	Longitude       *float64      `json:"longitude"`
	Author          authorView    `json:"author"`
	Photos          []photoView   `json:"photos"`
	LikesCount      int           `json:"likes_count"`
	CommentsCount   int           `json:"comments_count"`
	Liked           bool          `json:"liked"`
	PreviewBody     *string       `json:"preview_body,omitempty"`
	PreviewUsername *string       `json:"preview_username,omitempty"`
	Comments        []commentView `json:"comments,omitempty"`
}

func (deps Deps) createPost(w http.ResponseWriter, r *http.Request) {
	actor, name, ok := deps.actor(w, r)
	if !ok {
		return
	}
	if auth.ActionRefused(name) {
		writeError(w, http.StatusForbidden, "nom requis")
		return
	}
	if deps.Objects == nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	caption, latitude, longitude, files, ok := readPostForm(w, r)
	if !ok {
		return
	}
	type stored struct{ display, thumb string }
	var keys []stored
	cleanup := func() {
		for _, key := range keys {
			_ = deps.Objects.Delete(r.Context(), key.display)
			_ = deps.Objects.Delete(r.Context(), key.thumb)
		}
	}
	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			cleanup()
			writeError(w, http.StatusBadRequest, "fichier refusé")
			return
		}
		raw, err := io.ReadAll(io.LimitReader(file, maxPhotoBytes+1))
		file.Close()
		if err != nil || len(raw) == 0 || len(raw) > maxPhotoBytes {
			cleanup()
			writeError(w, http.StatusBadRequest, "fichier refusé")
			return
		}
		display, thumb, err := media.PhotoJPEGs(raw)
		if err != nil {
			cleanup()
			writeError(w, http.StatusBadRequest, "fichier refusé")
			return
		}
		displayKey, thumbKey, err := deps.Objects.PutPhoto(r.Context(), display, thumb)
		if err != nil {
			cleanup()
			writeError(w, http.StatusInternalServerError, "publication indisponible")
			return
		}
		keys = append(keys, stored{displayKey, thumbKey})
	}
	tx, err := deps.Pool.Begin(r.Context())
	if err != nil {
		cleanup()
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO posts (author_sub, caption, latitude, longitude)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, actor, caption, latitude, longitude).Scan(&id)
	if err != nil {
		cleanup()
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	for i, key := range keys {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO post_photos (post_id, position, display_key, thumbnail_key)
			VALUES ($1, $2, $3, $4)
		`, id, i+1, key.display, key.thumb); err != nil {
			cleanup()
			writeError(w, http.StatusInternalServerError, "publication indisponible")
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		cleanup()
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	view, err := deps.readPost(r.Context(), actor, id, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusCreated, view)
}

func (deps Deps) patchPost(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8192))
	if err != nil {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil || len(fields) == 0 {
		writeError(w, http.StatusBadRequest, "corps invalide")
		return
	}
	for key := range fields {
		if key != "caption" && key != "latitude" && key != "longitude" {
			writeError(w, http.StatusBadRequest, "corps invalide")
			return
		}
	}
	setCaption := false
	var caption *string
	if value, ok := fields["caption"]; ok {
		var text string
		if err := json.Unmarshal(value, &text); err != nil {
			writeError(w, http.StatusBadRequest, "légende invalide")
			return
		}
		text = strings.TrimSpace(text)
		if utf8.RuneCountInString(text) > maxCaption {
			writeError(w, http.StatusBadRequest, "légende invalide")
			return
		}
		if text != "" {
			caption = &text
		}
		setCaption = true
	}
	_, hasLat := fields["latitude"]
	_, hasLon := fields["longitude"]
	if hasLat != hasLon {
		writeError(w, http.StatusBadRequest, "position invalide")
		return
	}
	var latitude, longitude *float64
	if hasLat {
		latitude, ok = jsonCoord(w, fields["latitude"], -90, 90)
		if !ok {
			return
		}
		longitude, ok = jsonCoord(w, fields["longitude"], -180, 180)
		if !ok {
			return
		}
		if (latitude == nil) != (longitude == nil) {
			writeError(w, http.StatusBadRequest, "position invalide")
			return
		}
	}
	var updated string
	err = deps.Pool.QueryRow(r.Context(), `
		UPDATE posts SET
			caption = CASE WHEN $3 THEN $4 ELSE caption END,
			latitude = CASE WHEN $5 THEN $6 ELSE latitude END,
			longitude = CASE WHEN $5 THEN $7 ELSE longitude END
		WHERE id = $1 AND author_sub = $2
		RETURNING id
	`, id, session.Sub, setCaption, caption, hasLat, latitude, longitude).Scan(&updated)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	view, err := deps.readPost(r.Context(), session.Sub, id, false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func jsonCoord(w http.ResponseWriter, raw json.RawMessage, low, high float64) (*float64, bool) {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, true
	}
	var value float64
	if err := json.Unmarshal(raw, &value); err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < low || value > high {
		writeError(w, http.StatusBadRequest, "position invalide")
		return nil, false
	}
	return &value, true
}

func readPostForm(w http.ResponseWriter, r *http.Request) (*string, *float64, *float64, []*multipart.FileHeader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, int64(maxPhotos)*maxPhotoBytes+1<<20)
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return nil, nil, nil, nil, false
	}
	for key := range r.MultipartForm.Value {
		if key != "caption" && key != "latitude" && key != "longitude" {
			writeError(w, http.StatusBadRequest, "corps invalide")
			return nil, nil, nil, nil, false
		}
	}
	for key := range r.MultipartForm.File {
		if key != "file" {
			writeError(w, http.StatusBadRequest, "corps invalide")
			return nil, nil, nil, nil, false
		}
	}
	caption, ok := optionalText(w, r.MultipartForm.Value["caption"], maxCaption, "légende invalide")
	if !ok {
		return nil, nil, nil, nil, false
	}
	latitude, longitude, ok := readLocation(w, r.MultipartForm.Value["latitude"], r.MultipartForm.Value["longitude"])
	if !ok {
		return nil, nil, nil, nil, false
	}
	files := r.MultipartForm.File["file"]
	if len(files) < 1 || len(files) > maxPhotos {
		writeError(w, http.StatusBadRequest, "fichier refusé")
		return nil, nil, nil, nil, false
	}
	return caption, latitude, longitude, files, true
}

func optionalText(w http.ResponseWriter, values []string, max int, message string) (*string, bool) {
	if len(values) == 0 {
		return nil, true
	}
	if len(values) != 1 {
		writeError(w, http.StatusBadRequest, message)
		return nil, false
	}
	value := strings.TrimSpace(values[0])
	if value == "" {
		return nil, true
	}
	if utf8.RuneCountInString(value) > max {
		writeError(w, http.StatusBadRequest, message)
		return nil, false
	}
	return &value, true
}

func readLocation(w http.ResponseWriter, lats, longs []string) (*float64, *float64, bool) {
	lat, ok := oneCoord(w, lats, -90, 90)
	if !ok {
		return nil, nil, false
	}
	lon, ok := oneCoord(w, longs, -180, 180)
	if !ok {
		return nil, nil, false
	}
	if (lat == nil) != (lon == nil) {
		writeError(w, http.StatusBadRequest, "position invalide")
		return nil, nil, false
	}
	return lat, lon, true
}

func oneCoord(w http.ResponseWriter, values []string, low, high float64) (*float64, bool) {
	if len(values) == 0 {
		return nil, true
	}
	if len(values) != 1 {
		writeError(w, http.StatusBadRequest, "position invalide")
		return nil, false
	}
	raw := strings.TrimSpace(values[0])
	if raw == "" {
		return nil, true
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < low || value > high {
		writeError(w, http.StatusBadRequest, "position invalide")
		return nil, false
	}
	return &value, true
}
