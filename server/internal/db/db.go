package db

import (
	"context"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taviani/instacrane/server/migrations"
)

var versionPattern = regexp.MustCompile(`^[0-9]{3}_[a-z0-9_]+$`)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connexion postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connexion postgres: %w", err)
	}
	return pool, nil
}

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("table des migrations: %w", err)
	}

	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("lecture des migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	if len(names) == 0 {
		return fmt.Errorf("aucune migration")
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("connexion pour les migrations: %w", err)
	}
	defer conn.Release()
	pgConn := conn.Conn().PgConn()

	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		if !versionPattern.MatchString(version) {
			return fmt.Errorf("nom de migration invalide: %s", name)
		}
		var applied bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&applied); err != nil {
			return fmt.Errorf("lecture de %s: %w", version, err)
		}
		if applied {
			continue
		}
		script, err := migrations.FS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("lecture de %s: %w", name, err)
		}
		if err := apply(ctx, pgConn, version, string(script)); err != nil {
			return fmt.Errorf("migration %s: %w", version, err)
		}
	}
	return nil
}
