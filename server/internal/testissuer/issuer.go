package testissuer

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Issuer struct {
	URL    string
	server *httptest.Server
	key    *rsa.PrivateKey
	kid    string
}

func Start(t *testing.T) *Issuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	iss := &Issuer{key: key, kid: "test"}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/openid-configuration", iss.discovery)
	mux.HandleFunc("GET /jwks", iss.keys)
	iss.server = httptest.NewServer(mux)
	iss.URL = iss.server.URL
	t.Cleanup(iss.server.Close)
	return iss
}

func (iss *Issuer) Token(t *testing.T, sub string, email string, exp time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"iss": iss.URL,
		"sub": sub,
		"exp": exp.Unix(),
		"iat": time.Now().Unix(),
	}
	if email != "" {
		claims["email"] = email
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = iss.kid
	raw, err := token.SignedString(iss.key)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func (iss *Issuer) discovery(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"issuer":                                iss.URL,
		"jwks_uri":                              iss.URL + "/jwks",
		"authorization_endpoint":                iss.URL + "/authorize",
		"token_endpoint":                        iss.URL + "/token",
		"id_token_signing_alg_values_supported": []string{"RS256"},
	})
}

func (iss *Issuer) keys(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"keys": []map[string]string{{
			"kty": "RSA",
			"use": "sig",
			"alg": "RS256",
			"kid": iss.kid,
			"n":   base64.RawURLEncoding.EncodeToString(iss.key.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(iss.key.E)).Bytes()),
		}},
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
