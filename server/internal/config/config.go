package config

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	Addr        string
}

func Load() (Config, error) {
	raw := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if raw == "" {
		return Config{}, errors.New("DATABASE_URL manquant")
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		return Config{}, errors.New("DATABASE_URL doit être une URL postgres")
	}
	return Config{DatabaseURL: raw, Addr: ":8000"}, nil
}
