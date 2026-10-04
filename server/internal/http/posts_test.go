package api

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/db"
	"github.com/taviani/instacrane/server/internal/dbtest"
	"github.com/taviani/instacrane/server/internal/testissuer"
)

func TestPublications(t *testing.T) {
	ctx := context.Background()
	pool := dbtest.Pool(t)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	store := testStore(t)
	if err := store.EnsureBucket(ctx); err != nil {
		t.Fatal(err)
	}
	iss := testissuer.Start(t)
	verifier, err := auth.NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(Deps{Pool: pool, Sessions: verifier, Objects: store})
	token := func(sub string) string {
		return iss.Token(t, sub, sub+"@example.test", time.Now().Add(time.Hour))
	}
	for _, sub := range []string{"virginie", "paul", "sans-nom", "lea"} {
		if call(t, handler, http.MethodGet, "/api/users/me", token(sub), "").Code != http.StatusOK {
			t.Fatalf("ouverture %s", sub)
		}
	}
	for _, name := range []string{"virginie", "paul", "lea"} {
		res := call(t, handler, http.MethodPatch, "/api/users/me", token(name), `{"username":"`+name+`"}`)
		if res.Code != http.StatusOK {
			t.Fatalf("nom %s: %d %s", name, res.Code, res.Body)
		}
	}
	photo := markedJPEG(t)
	if publish(t, handler, token("sans-nom"), nil, photo, 1).Code != http.StatusForbidden {
		t.Fatal("publier sans nom doit être refusé")
	}
	if publish(t, handler, token("paul"), map[string]string{"latitude": "48.8"}, photo, 1).Code != http.StatusBadRequest {
		t.Fatal("une seule coordonnée doit être refusée")
	}
	if publish(t, handler, token("paul"), map[string]string{"caption": "bonjour"}, []byte("bonjour"), 1).Code != http.StatusBadRequest {
		t.Fatal("un fichier qui n'est pas une photo doit être refusé")
	}

	created := publish(t, handler, token("paul"), map[string]string{
		"caption":   "bonjour",
		"latitude":  "48.8",
		"longitude": "2.3",
	}, photo, 1)
	if created.Code != http.StatusCreated {
		t.Fatalf("publication: %d %#v", created.Code, created.Body)
	}
	paulID, _ := created.Body["id"].(string)
	if created.Body["caption"] != "bonjour" || created.Body["latitude"] != 48.8 {
		t.Fatalf("champs: %#v", created.Body)
	}
	if _, ok := created.Body["thumbnail_key"]; ok {
		t.Fatal("la clé ne doit pas sortir")
	}
	photos, _ := created.Body["photos"].([]any)
	if len(photos) != 1 {
		t.Fatalf("photos: %#v", created.Body["photos"])
	}
	photoURL, _ := photos[0].(map[string]any)["url"].(string)
	if photoURL == "" || bytes.Contains(httpBody(t, photoURL), []byte("GPSLAT")) {
		t.Fatal("la photo stockée garde une position")
	}
	owner := call(t, handler, http.MethodGet, "/api/users/me", token("paul"), "")
	if _, ok := owner.Body["latitude"]; ok {
		t.Fatal("la position ne va pas sur le profil")
	}
	if _, err := pool.Exec(ctx, `UPDATE posts SET created_at = $2 WHERE id = $1`, paulID, time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}

	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/posts/feed", token("virginie"), ""))) != 0 {
		t.Fatal("le fil voit une publication non acceptée")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))) != 0 {
		t.Fatal("la grille est ouverte trop tôt")
	}
	if call(t, handler, http.MethodGet, "/api/posts/"+paulID, token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("le détail existe sans acceptation")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("demande")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("paul"), "").Code != http.StatusOK {
		t.Fatal("acceptation")
	}
	grid := postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))
	if len(grid) != 1 || grid[0]["id"] != paulID {
		t.Fatalf("historique: %#v", grid)
	}
	if _, ok := grid[0]["thumbnail_key"]; ok {
		t.Fatal("la grille renvoie la clé")
	}

	virginiePost := publish(t, handler, token("virginie"), map[string]string{"caption": "chez moi"}, photo, 1)
	if virginiePost.Code != http.StatusCreated || virginiePost.Body["latitude"] != nil {
		t.Fatalf("sans position: %#v", virginiePost.Body)
	}
	virginieID, _ := virginiePost.Body["id"].(string)
	feed := postsOf(t, call(t, handler, http.MethodGet, "/api/posts/feed", token("virginie"), ""))
	if len(feed) != 2 || feed[0]["id"] != virginieID || feed[1]["id"] != paulID {
		t.Fatalf("fil: %#v", feed)
	}
	paulFeed := postsOf(t, call(t, handler, http.MethodGet, "/api/posts/feed", token("paul"), ""))
	if len(paulFeed) != 1 || paulFeed[0]["id"] != paulID {
		t.Fatalf("fil de Paul: %#v", paulFeed)
	}
	if call(t, handler, http.MethodGet, "/api/posts/"+virginieID, token("paul"), "").Code != http.StatusNotFound {
		t.Fatal("Paul voit la publication de Virginie")
	}

	liked := call(t, handler, http.MethodPost, "/api/posts/"+paulID+"/like", token("virginie"), "")
	if liked.Code != http.StatusCreated {
		t.Fatalf("like: %d", liked.Code)
	}
	again := call(t, handler, http.MethodPost, "/api/posts/"+paulID+"/like", token("virginie"), "")
	if again.Code != http.StatusOK || again.Body["likes_count"] != float64(1) {
		t.Fatalf("second like: %#v", again.Body)
	}
	var likes int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM likes`).Scan(&likes); err != nil || likes != 1 {
		t.Fatalf("lignes de like = %d", likes)
	}
	comment := call(t, handler, http.MethodPost, "/api/posts/"+paulID+"/comments", token("virginie"), `{"body":"vu"}`)
	if comment.Code != http.StatusCreated {
		t.Fatalf("commentaire: %d %#v", comment.Code, comment.Body)
	}
	commentID, _ := comment.Body["id"].(string)
	detail := call(t, handler, http.MethodGet, "/api/posts/"+paulID, token("virginie"), "")
	if detail.Body["comments_count"] != float64(1) || detail.Body["caption"] != "bonjour" {
		t.Fatalf("détail: %#v", detail.Body)
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulID+"/comments", token("sans-nom"), `{"body":"non"}`).Code != http.StatusForbidden {
		t.Fatal("commenter sans nom")
	}
	if call(t, handler, http.MethodDelete, "/api/posts/"+paulID+"/comments/"+commentID, token("lea"), "").Code != http.StatusNotFound {
		t.Fatal("un tiers efface le commentaire")
	}
	if call(t, handler, http.MethodDelete, "/api/posts/"+paulID+"/comments/"+commentID, token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("l'auteur de la publication efface le commentaire")
	}
	own := call(t, handler, http.MethodPost, "/api/posts/"+paulID+"/comments", token("virginie"), `{"body":"encore"}`)
	ownID, _ := own.Body["id"].(string)
	if call(t, handler, http.MethodDelete, "/api/posts/"+paulID+"/comments/"+ownID, token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("l'auteur du commentaire l'efface")
	}
	var notes int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM notifications`).Scan(&notes); err != nil || notes != 0 {
		t.Fatalf("notifications = %d", notes)
	}

	if call(t, handler, http.MethodDelete, "/api/posts/"+paulID, token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("Virginie efface la publication de Paul")
	}
	if httpStatus(t, photoURL) != http.StatusOK {
		t.Fatal("la photo a disparu")
	}
	if call(t, handler, http.MethodDelete, "/api/posts/"+paulID, token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("suppression")
	}
	if call(t, handler, http.MethodGet, "/api/posts/"+paulID, token("paul"), "").Code != http.StatusNotFound {
		t.Fatal("la publication reste")
	}
	if httpStatus(t, photoURL) == http.StatusOK {
		t.Fatal("le fichier reste")
	}

	avatar := uploadAvatar(t, handler, token("virginie"), 30, 20)
	avatarURL, _ := avatar.Body["avatar_url"].(string)
	if call(t, handler, http.MethodDelete, "/api/users/me", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("suppression du compte")
	}
	var left int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE sub = 'virginie'`).Scan(&left); err != nil || left != 0 {
		t.Fatalf("profil restant = %d", left)
	}
	if httpStatus(t, avatarURL) == http.StatusOK {
		t.Fatal("l'avatar reste")
	}
}

func publish(t *testing.T, handler http.Handler, token string, fields map[string]string, raw []byte, count int) recorded {
	t.Helper()
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)
	for key, value := range fields {
		if err := form.WriteField(key, value); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < count; i++ {
		part, err := form.CreateFormFile("file", "photo.jpg")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(raw); err != nil {
			t.Fatal(err)
		}
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/posts", &buf)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", form.FormDataContentType())
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return decodeRecorded(t, rec)
}

func decodeRecorded(t *testing.T, rec *httptest.ResponseRecorder) recorded {
	t.Helper()
	out := recorded{Code: rec.Code}
	if strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(rec.Body.Bytes(), &out.Body); err != nil {
			t.Fatalf("json: %v %s", err, rec.Body.String())
		}
	}
	return out
}

func markedJPEG(t *testing.T) []byte {
	t.Helper()
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, image.NewRGBA(image.Rect(0, 0, 30, 20)), &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	payload := []byte("GPSLAT")
	marker := append([]byte{0xFF, 0xE1, 0, byte(len(payload) + 2)}, payload...)
	encoded := raw.Bytes()
	out := append([]byte{}, encoded[:2]...)
	out = append(out, marker...)
	return append(out, encoded[2:]...)
}

func httpBody(t *testing.T, url string) []byte {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(res.Body); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func httpStatus(t *testing.T, url string) int {
	t.Helper()
	res, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	return res.StatusCode
}
