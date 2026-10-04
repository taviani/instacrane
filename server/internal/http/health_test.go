package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthWithoutSession(t *testing.T) {
	for _, header := range []string{"", "not-a-session"} {
		req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		rec := httptest.NewRecorder()
		New(Deps{}).ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("statut = %d", rec.Code)
		}
		var body map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body["status"] != "ok" {
			t.Fatalf("corps = %s", rec.Body.String())
		}
	}
}

func TestMeWithoutSessionIsRefused(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/users/me", nil)
	rec := httptest.NewRecorder()
	New(Deps{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("statut = %d", rec.Code)
	}
}

func TestUnknownRoute(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/nowhere", nil)
	rec := httptest.NewRecorder()
	New(Deps{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("statut = %d", rec.Code)
	}
}
