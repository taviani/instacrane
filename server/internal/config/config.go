package config

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

type Storage struct {
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
}

type Config struct {
	DatabaseURL string
	IssuerURL   string
	Storage     Storage
	Addr        string
	Origins     []string
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
	storage, err := storageConfig()
	if err != nil {
		return Config{}, err
	}
	return Config{DatabaseURL: raw, IssuerURL: issuer, Storage: storage, Addr: ":8000", Origins: origins()}, nil
}

func origins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ORIGINS"))
	if raw == "" {
		return nil
	}
	var list []string
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			list = append(list, item)
		}
	}
	return list
}

func storageConfig() (Storage, error) {
	endpoint := strings.TrimSpace(os.Getenv("STORAGE_ENDPOINT"))
	bucket := strings.TrimSpace(os.Getenv("STORAGE_BUCKET"))
	accessKey := strings.TrimSpace(os.Getenv("STORAGE_ACCESS_KEY"))
	secretKey := strings.TrimSpace(os.Getenv("STORAGE_SECRET_KEY"))
	if endpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		return Storage{}, errors.New("stockage incomplet")
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return Storage{}, errors.New("STORAGE_ENDPOINT doit être une URL http ou https")
	}
	return Storage{
		Endpoint:  endpoint,
		Bucket:    bucket,
		AccessKey: accessKey,
		SecretKey: secretKey,
	}, nil
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
