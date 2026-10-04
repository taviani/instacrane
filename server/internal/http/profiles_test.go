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
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/config"
	"github.com/taviani/instacrane/server/internal/db"
	"github.com/taviani/instacrane/server/internal/dbtest"
	"github.com/taviani/instacrane/server/internal/media"
	"github.com/taviani/instacrane/server/internal/testissuer"
)

func TestProfilesAndFollows(t *testing.T) {
	ctx := context.Background()
	pool := dbtest.Pool(t)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	iss := testissuer.Start(t)
	verifier, err := auth.NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(Deps{Pool: pool, Sessions: verifier})
	token := func(sub string) string {
		return iss.Token(t, sub, sub+"@example.test", time.Now().Add(time.Hour))
	}
	open := func(sub string) {
		t.Helper()
		res := call(t, handler, http.MethodGet, "/api/users/me", token(sub), "")
		if res.Code != http.StatusOK {
			t.Fatalf("ouverture %s: %d %s", sub, res.Code, res.Body)
		}
	}
	open("virginie")
	open("paul")
	named := call(t, handler, http.MethodPatch, "/api/users/me", token("virginie"), `{"username":"virginie","display_name":"Virginie","bio":"photos"}`)
	if named.Code != http.StatusOK || named.Body["email"] != "virginie@example.test" {
		t.Fatalf("profil virginie: %d %#v", named.Code, named.Body)
	}
	if _, ok := named.Body["avatar_key"]; ok {
		t.Fatal("la clé d'objet ne doit pas sortir")
	}
	if call(t, handler, http.MethodPatch, "/api/users/me", token("paul"), `{"username":"paul","display_name":"Paul"}`).Code != http.StatusOK {
		t.Fatal("profil paul")
	}

	anon := call(t, handler, http.MethodGet, "/api/users/me", token("sans-nom"), "")
	if anon.Code != http.StatusOK {
		t.Fatal(anon.Body)
	}
	reserved := call(t, handler, http.MethodPatch, "/api/users/me", token("sans-nom"), `{"username":"search"}`)
	if reserved.Code != http.StatusBadRequest {
		t.Fatalf("nom réservé: %d", reserved.Code)
	}
	refused := call(t, handler, http.MethodPost, "/api/users/paul/follow", token("sans-nom"), "")
	if refused.Code != http.StatusForbidden {
		t.Fatalf("sans nom: %d %s", refused.Code, refused.Body)
	}

	self := call(t, handler, http.MethodPost, "/api/users/virginie/follow", token("virginie"), "")
	if self.Code != http.StatusBadRequest {
		t.Fatalf("soi-même: %d", self.Code)
	}
	missing := call(t, handler, http.MethodGet, "/api/users/inconnu/posts", token("virginie"), "")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("inconnu: %d", missing.Code)
	}

	first := call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "")
	if first.Code != http.StatusCreated || first.Body["status"] != "pending" {
		t.Fatalf("demande: %d %#v", first.Code, first.Body)
	}
	again := call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "")
	if again.Code != http.StatusOK {
		t.Fatalf("doublon: %d %#v", again.Code, again.Body)
	}
	var rows int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM follows`).Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("lignes de suivi = %d (%v)", rows, err)
	}
	var notes int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM notifications`).Scan(&notes); err != nil || notes != 0 {
		t.Fatalf("notifications = %d (%v)", notes, err)
	}

	hidden := call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), "")
	if hidden.Code != http.StatusOK || len(postsOf(t, hidden)) != 0 {
		t.Fatalf("photos cachées: %#v", hidden.Body)
	}
	card := call(t, handler, http.MethodGet, "/api/users/paul", token("virginie"), "")
	if card.Code != http.StatusOK || card.Body["follow_request"] != "pending" || card.Body["email"] != nil {
		t.Fatalf("fiche: %#v", card.Body)
	}
	if card.Body["followers_count"] != float64(0) {
		t.Fatalf("compteur: %#v", card.Body["followers_count"])
	}

	stranger := call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("virginie"), "")
	if stranger.Code != http.StatusNotFound {
		t.Fatalf("mauvaise personne: %d", stranger.Code)
	}
	inbox := call(t, handler, http.MethodGet, "/api/users/me/follow-requests", token("paul"), "")
	users, _ := inbox.Body["users"].([]any)
	if inbox.Code != http.StatusOK || len(users) != 1 {
		t.Fatalf("demandes reçues: %#v", inbox.Body)
	}
	accepted := call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("paul"), "")
	if accepted.Code != http.StatusOK || accepted.Body["status"] != "accepted" {
		t.Fatalf("acceptation: %#v", accepted.Body)
	}
	if call(t, handler, http.MethodGet, "/api/users/paul", token("virginie"), "").Body["followers_count"] != float64(1) {
		t.Fatal("abonné accepté non compté")
	}
	following := call(t, handler, http.MethodGet, "/api/users/virginie/following", token("paul"), "")
	followed, _ := following.Body["users"].([]any)
	if len(followed) != 1 {
		t.Fatalf("abonnements: %#v", following.Body)
	}
	paulSees := call(t, handler, http.MethodGet, "/api/users/virginie/posts", token("paul"), "")
	if len(postsOf(t, paulSees)) != 0 {
		t.Fatal("le sens inverse ne s'ouvre pas")
	}

	insertPost(t, pool, "paul", "10000000-0000-4000-8000-000000000001", time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC), 2)
	insertPost(t, pool, "paul", "10000000-0000-4000-8000-000000000002", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), 1)
	page := call(t, handler, http.MethodGet, "/api/users/paul/posts?limit=1", token("virginie"), "")
	got := postsOf(t, page)
	if len(got) != 1 || got[0]["id"] != "10000000-0000-4000-8000-000000000001" || got[0]["photo_count"] != float64(2) {
		t.Fatalf("page: %#v", got)
	}
	if got[0]["thumbnail_key"] != "thumbs/10000000-0000-4000-8000-000000000001.jpg" {
		t.Fatalf("miniature: %#v", got[0])
	}
	older := call(t, handler, http.MethodGet, "/api/users/paul/posts?limit=1&before="+url.QueryEscape(got[0]["created_at"].(string)+"|10000000-0000-4000-8000-000000000001"), token("virginie"), "")
	rest := postsOf(t, older)
	if len(rest) != 1 || rest[0]["id"] != "10000000-0000-4000-8000-000000000002" {
		t.Fatalf("page suivante: %#v", rest)
	}

	back := call(t, handler, http.MethodPost, "/api/users/virginie/follow", token("paul"), "")
	if back.Code != http.StatusCreated {
		t.Fatalf("demande inverse: %d", back.Code)
	}
	if call(t, handler, http.MethodDelete, "/api/users/paul/follow/request", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("refus")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/virginie/posts", token("paul"), ""))) != 0 {
		t.Fatal("un refus ouvre les photos")
	}

	if call(t, handler, http.MethodDelete, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("désabonnement")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))) != 0 {
		t.Fatal("les photos restent visibles après désabonnement")
	}

	found := call(t, handler, http.MethodGet, "/api/users/search/Paul", token("virginie"), "")
	people, _ := found.Body["users"].([]any)
	if found.Code != http.StatusOK || len(people) != 1 {
		t.Fatalf("recherche: %#v", found.Body)
	}
	person, _ := people[0].(map[string]any)
	if person["email"] != nil || person["username"] != "paul" {
		t.Fatalf("résultat: %#v", person)
	}
	wild := call(t, handler, http.MethodGet, "/api/users/search/%25", token("virginie"), "")
	nobody, _ := wild.Body["users"].([]any)
	if len(nobody) != 0 {
		t.Fatalf("joker: %#v", wild.Body)
	}
}

func TestAvatarReplacesPrevious(t *testing.T) {
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
	token := iss.Token(t, "ada", "ada@example.test", time.Now().Add(time.Hour))
	if call(t, handler, http.MethodGet, "/api/users/me", token, "").Code != http.StatusOK {
		t.Fatal("profil")
	}
	first := uploadAvatar(t, handler, token, 40, 20)
	if first.Code != http.StatusOK || first.Body["avatar_url"] == nil {
		t.Fatalf("avatar: %d %#v", first.Code, first.Body)
	}
	oldURL, _ := first.Body["avatar_url"].(string)
	second := uploadAvatar(t, handler, token, 30, 30)
	newURL, _ := second.Body["avatar_url"].(string)
	if second.Code != http.StatusOK || newURL == "" || newURL == oldURL {
		t.Fatalf("remplacement: %#v", second.Body)
	}
	res, err := http.Get(oldURL)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode == http.StatusOK {
		t.Fatal("ancien objet encore lisible")
	}
	text := uploadRaw(t, handler, token, "file", "note.txt", []byte("bonjour"))
	if text.Code != http.StatusBadRequest {
		t.Fatalf("fichier refusé: %d", text.Code)
	}
}

func postsOf(t *testing.T, res recorded) []map[string]any {
	t.Helper()
	raw, _ := res.Body["posts"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		post, _ := item.(map[string]any)
		out = append(out, post)
	}
	return out
}

func insertPost(t *testing.T, pool *pgxpool.Pool, sub, id string, at time.Time, photos int) {
	t.Helper()
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO posts (id, author_sub, created_at) VALUES ($1, $2, $3)`, id, sub, at); err != nil {
		t.Fatal(err)
	}
	for position := 1; position <= photos; position++ {
		if _, err := pool.Exec(ctx, `
			INSERT INTO post_photos (post_id, position, display_key, thumbnail_key)
			VALUES ($1, $2, $3, $4)
		`, id, position, "photos/"+id+".jpg", "thumbs/"+id+".jpg"); err != nil {
			t.Fatal(err)
		}
	}
}

func testStore(t *testing.T) *media.Store {
	t.Helper()
	cfg := config.Storage{
		Endpoint:  os.Getenv("STORAGE_ENDPOINT"),
		Bucket:    os.Getenv("STORAGE_BUCKET"),
		AccessKey: os.Getenv("STORAGE_ACCESS_KEY"),
		SecretKey: os.Getenv("STORAGE_SECRET_KEY"),
	}
	if cfg.Endpoint == "" || cfg.Bucket == "" || cfg.AccessKey == "" || cfg.SecretKey == "" {
		t.Fatal("STORAGE_* manquant : le MinIO de docker compose")
	}
	store, err := media.NewStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func uploadAvatar(t *testing.T, handler http.Handler, token string, width, height int) recorded {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, img, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	return uploadRaw(t, handler, token, "file", "photo.jpg", raw.Bytes())
}

func uploadRaw(t *testing.T, handler http.Handler, token, field, name string, body []byte) recorded {
	t.Helper()
	var buf bytes.Buffer
	form := multipart.NewWriter(&buf)
	part, err := form.CreateFormFile(field, name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(body); err != nil {
		t.Fatal(err)
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/users/me/avatar", &buf)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", form.FormDataContentType())
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	out := recorded{Code: rec.Code}
	if strings.Contains(rec.Header().Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(rec.Body.Bytes(), &out.Body); err != nil {
			t.Fatalf("json: %v %s", err, rec.Body.String())
		}
	}
	return out
}
