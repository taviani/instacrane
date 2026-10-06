package api

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestUsersMe(t *testing.T) {
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
	token := func(sub, email string) string {
		return iss.Token(t, sub, email, time.Now().Add(time.Hour))
	}

	first := call(t, handler, http.MethodGet, "/api/users/me", token("ada-sub", "ada@example.test"), "")
	if first.Code != http.StatusOK {
		t.Fatalf("création: %d %s", first.Code, first.Body)
	}
	if first.Body["email"] != "ada@example.test" || first.Body["username"] != nil {
		t.Fatalf("profil = %#v", first.Body)
	}
	if first.Body["sub"] != "ada-sub" {
		t.Fatalf("sub = %#v", first.Body["sub"])
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	kept := call(t, handler, http.MethodGet, "/api/users/me", token("ada-sub", ""), "")
	if kept.Code != http.StatusOK || kept.Body["email"] != "ada@example.test" {
		t.Fatalf("email conservé = %#v", kept.Body)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("profils = %d", count)
	}

	updated := call(t, handler, http.MethodGet, "/api/users/me", token("ada-sub", "ada@suite.test"), "")
	if updated.Body["email"] != "ada@suite.test" {
		t.Fatalf("email = %#v", updated.Body["email"])
	}

	missing := call(t, handler, http.MethodPatch, "/api/users/me", token("bob-sub", "bob@example.test"), `{"username":"bob"}`)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("profil absent: %d %s", missing.Code, missing.Body)
	}

	bad := call(t, handler, http.MethodPatch, "/api/users/me", token("ada-sub", ""), `{"username":"a"}`)
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("nom court: %d", bad.Code)
	}
	extra := call(t, handler, http.MethodPatch, "/api/users/me", token("ada-sub", ""), `{"username":"ada","email":"x"}`)
	if extra.Code != http.StatusBadRequest {
		t.Fatalf("champ refusé: %d", extra.Code)
	}
	named := call(t, handler, http.MethodPatch, "/api/users/me", token("ada-sub", ""), `{"username":"ada"}`)
	if named.Code != http.StatusOK || named.Body["username"] != "ada" {
		t.Fatalf("nom = %#v", named.Body)
	}
	again := call(t, handler, http.MethodPatch, "/api/users/me", token("ada-sub", ""), `{"username":"ada_2"}`)
	if again.Code != http.StatusConflict {
		t.Fatalf("second nom: %d %s", again.Code, again.Body)
	}

	other := call(t, handler, http.MethodGet, "/api/users/me", token("bea-sub", "bea@example.test"), "")
	if other.Code != http.StatusOK {
		t.Fatal(other.Body)
	}
	taken := call(t, handler, http.MethodPatch, "/api/users/me", token("bea-sub", ""), `{"username":"ada"}`)
	if taken.Code != http.StatusConflict {
		t.Fatalf("nom pris: %d %s", taken.Code, taken.Body)
	}

	login := call(t, handler, http.MethodPost, "/api/auth/login", "", "")
	if login.Code != http.StatusNotFound {
		t.Fatalf("connexion locale: %d", login.Code)
	}
}

type recorded struct {
	Code int
	Body map[string]any
}

func call(t *testing.T, handler http.Handler, method, path, token, body string) recorded {
	t.Helper()
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, path, reader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
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
