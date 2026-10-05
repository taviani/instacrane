package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestSiteLeavesAPIAlone(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("site"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := WithSite(New(Deps{}), root)
	for _, target := range []string{"/api/health", "/api/nowhere"} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if target == "/api/health" && rec.Code != http.StatusOK {
			t.Fatalf("health = %d", rec.Code)
		}
		if target == "/api/nowhere" && rec.Code != http.StatusNotFound {
			t.Fatalf("route inconnue = %d", rec.Code)
		}
		if rec.Body.String() == "site" {
			t.Fatalf("%s a renvoyé le site", target)
		}
	}
}

func TestSiteServesFileOrPage(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("page"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "assets", "icon.png"), []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := WithSite(New(Deps{}), root)

	file := httptest.NewRecorder()
	handler.ServeHTTP(file, httptest.NewRequest(http.MethodGet, "/assets/icon.png", nil))
	if file.Code != http.StatusOK || file.Body.String() != "png" {
		t.Fatalf("fichier = %d %q", file.Code, file.Body.String())
	}

	page := httptest.NewRecorder()
	handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/user/virginie", nil))
	if page.Code != http.StatusOK || page.Body.String() != "page" {
		t.Fatalf("page = %d %q", page.Code, page.Body.String())
	}

	escaped := httptest.NewRecorder()
	handler.ServeHTTP(escaped, httptest.NewRequest(http.MethodGet, "/../"+filepath.Base(outside), nil))
	if escaped.Body.String() == "secret" {
		t.Fatal("le site a servi un fichier hors du dossier")
	}
}

func TestSiteWithoutRootDoesNotServe(t *testing.T) {
	rec := httptest.NewRecorder()
	WithSite(New(Deps{}), "").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("statut = %d", rec.Code)
	}
}
