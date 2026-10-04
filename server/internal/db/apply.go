package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
)

func apply(ctx context.Context, pgConn *pgconn.PgConn, version, script string) error {
	if err := exec(ctx, pgConn, "BEGIN"); err != nil {
		return err
	}
	if err := exec(ctx, pgConn, script); err != nil {
		_ = exec(ctx, pgConn, "ROLLBACK")
		return err
	}
	if err := exec(ctx, pgConn, `INSERT INTO schema_migrations (version) VALUES ('`+version+`')`); err != nil {
		_ = exec(ctx, pgConn, "ROLLBACK")
		return err
	}
	if err := exec(ctx, pgConn, "COMMIT"); err != nil {
		_ = exec(ctx, pgConn, "ROLLBACK")
		return err
	}
	return nil
}

func exec(ctx context.Context, pgConn *pgconn.PgConn, sql string) error {
	results := pgConn.Exec(ctx, sql)
	if err := results.Close(); err != nil {
		return fmt.Errorf("sql: %w", err)
	}
	return nil
}
