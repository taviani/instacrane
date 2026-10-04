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

func TestLoadAcceptsPostgresURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/instacrane")
	t.Setenv("ISSUER_URL", "http://127.0.0.1:9")
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
