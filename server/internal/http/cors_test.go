package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORSAllowsLocalWeb(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/users/me", nil)
	req.Header.Set("Origin", "http://localhost:8081")
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "authorization, content-type")
	rec := httptest.NewRecorder()
	WithCORS(New(Deps{}), nil).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("statut = %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:8081" {
		t.Fatalf("origine = %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
	if !strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Fatalf("entêtes = %q", rec.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestCORSKeepsHealthForLocalOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set("Origin", "http://127.0.0.1:8081")
	rec := httptest.NewRecorder()
	WithCORS(New(Deps{}), nil).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("statut = %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:8081" {
		t.Fatalf("origine = %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSRefusesAnotherSite(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()
	WithCORS(New(Deps{}), []string{"https://app.example"}).ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("origine = %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/posts", nil)
	req.Header.Set("Origin", "https://app.example")
	rec := httptest.NewRecorder()
	WithCORS(New(Deps{}), []string{"https://app.example"}).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("statut = %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "https://app.example" {
		t.Fatalf("origine = %q", rec.Header().Get("Access-Control-Allow-Origin"))
	}
}
