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

func TestLoadAcceptsPostgresURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/instacrane")
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
}
