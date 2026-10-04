package config

import "testing"

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("une URL absente doit être refusée")
	}
}

func TestLoadRejectsNonPostgresURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "mysql://localhost/instacrane")
	if _, err := Load(); err == nil {
		t.Fatal("un autre schéma doit être refusé")
	}
}

func TestLoadRequiresIssuerURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/instacrane")
	t.Setenv("ISSUER_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("une adresse d'issuer absente doit être refusée")
	}
}

func TestLoadRequiresStorage(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/instacrane")
	t.Setenv("ISSUER_URL", "http://127.0.0.1:9")
	t.Setenv("STORAGE_ENDPOINT", "")
	t.Setenv("STORAGE_BUCKET", "")
	t.Setenv("STORAGE_ACCESS_KEY", "")
	t.Setenv("STORAGE_SECRET_KEY", "")
	if _, err := Load(); err == nil {
		t.Fatal("un stockage absent doit être refusé")
	}
}

func TestLoadAcceptsPostgresURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/instacrane")
	t.Setenv("ISSUER_URL", "http://127.0.0.1:9")
	t.Setenv("STORAGE_ENDPOINT", "http://127.0.0.1:9000")
	t.Setenv("STORAGE_BUCKET", "media")
	t.Setenv("STORAGE_ACCESS_KEY", "access")
	t.Setenv("STORAGE_SECRET_KEY", "secret")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":8000" {
		t.Fatalf("port = %s", cfg.Addr)
	}
	if cfg.DatabaseURL != "postgres://localhost/instacrane" {
		t.Fatalf("url = %s", cfg.DatabaseURL)
	}
	if cfg.IssuerURL != "http://127.0.0.1:9" {
		t.Fatalf("issuer = %s", cfg.IssuerURL)
	}
}
