package config

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	IssuerURL   string
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
	issuer, err := issuerURL()
	if err != nil {
		return Config{}, err
	}
	return Config{DatabaseURL: raw, IssuerURL: issuer, Addr: ":8000"}, nil
}

func issuerURL() (string, error) {
	raw := strings.TrimSpace(os.Getenv("ISSUER_URL"))
	if raw == "" {
		return "", errors.New("ISSUER_URL manquant")
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return "", errors.New("ISSUER_URL doit être une URL http ou https")
	}
	return raw, nil
}
