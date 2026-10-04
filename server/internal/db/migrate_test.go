package db

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigrateCreatesSpecSchema(t *testing.T) {
	ctx := context.Background()
	pool := emptyDatabase(t)
	if err := Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	var versions int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&versions); err != nil {
		t.Fatal(err)
	}
	if versions != 1 {
		t.Fatalf("migrations appliquées = %d", versions)
	}

	tables := map[string]bool{}
	rows, err := pool.Query(ctx, `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
	`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		tables[name] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{
		"users", "follows", "posts", "post_photos", "comments", "likes",
		"notifications", "push_tokens", "blocks", "reports",
	} {
		if !tables[name] {
			t.Errorf("table absente: %s", name)
		}
	}

	var forbidden int
	if err := pool.QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND (column_name ILIKE '%password%' OR column_name ILIKE '%url%')
	`).Scan(&forbidden); err != nil {
		t.Fatal(err)
	}
	if forbidden != 0 {
		t.Fatalf("colonnes interdites = %d", forbidden)
	}

	assertColumns(t, ctx, pool, "users", []string{
		"sub", "email", "username", "display_name", "bio", "avatar_key", "created_at",
	})
	assertColumns(t, ctx, pool, "follows", []string{"follower_sub", "following_sub"})
	assertColumns(t, ctx, pool, "posts", []string{"id", "author_sub", "caption", "created_at"})
	assertColumns(t, ctx, pool, "post_photos", []string{"post_id", "position", "display_key", "thumbnail_key"})
	assertColumns(t, ctx, pool, "comments", []string{"id", "author_sub", "post_id", "body", "created_at"})
	assertColumns(t, ctx, pool, "likes", []string{"user_sub", "post_id"})
	assertColumns(t, ctx, pool, "notifications", []string{
		"id", "recipient_sub", "actor_sub", "type", "post_id", "created_at", "is_read",
	})
	assertColumns(t, ctx, pool, "push_tokens", []string{"user_sub", "token"})
	assertColumns(t, ctx, pool, "blocks", []string{"blocker_sub", "blocked_sub"})
	assertColumns(t, ctx, pool, "reports", []string{
		"id", "reporter_sub", "target_user_sub", "target_post_id", "created_at",
	})

	if _, err := pool.Exec(ctx, `INSERT INTO users (sub) VALUES ('a'), ('b')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (sub, username) VALUES ('c', 'ada')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (sub, username) VALUES ('d', 'ada')`); err == nil {
		t.Fatal("un nom d'utilisateur dupliqué doit être refusé")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (sub, username) VALUES ('e', 'ab')`); err == nil {
		t.Fatal("un nom trop court doit être refusé")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO follows (follower_sub, following_sub) VALUES ('a', 'b')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO follows (follower_sub, following_sub) VALUES ('a', 'b')`); err == nil {
		t.Fatal("un suivi dupliqué doit être refusé")
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO posts (author_sub, caption) VALUES ('a', 'bonjour')
	`); err != nil {
		t.Fatal(err)
	}
	var postID string
	if err := pool.QueryRow(ctx, `SELECT id FROM posts`).Scan(&postID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO post_photos (post_id, position, display_key, thumbnail_key)
		VALUES ($1, 1, 'display', 'thumb')
	`, postID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO post_photos (post_id, position, display_key, thumbnail_key)
		VALUES ($1, 21, 'display', 'thumb')
	`, postID); err == nil {
		t.Fatal("une photo hors intervalle doit être refusée")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO likes (user_sub, post_id) VALUES ('b', $1)`, postID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO likes (user_sub, post_id) VALUES ('b', $1)`, postID); err == nil {
		t.Fatal("un like dupliqué doit être refusé")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO push_tokens (user_sub, token) VALUES ('a', 'tok')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO push_tokens (user_sub, token) VALUES ('a', 'autre')`); err == nil {
		t.Fatal("un second jeton d'alerte doit être refusé")
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO notifications (recipient_sub, actor_sub, type) VALUES ('a', 'b', 'follow')
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO notifications (recipient_sub, actor_sub, type, post_id) VALUES ('a', 'b', 'like', $1)
	`, postID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO notifications (recipient_sub, actor_sub, type) VALUES ('a', 'b', 'like')
	`); err == nil {
		t.Fatal("un like sans publication doit être refusé")
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO reports (reporter_sub, target_user_sub) VALUES ('a', 'b')
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO reports (reporter_sub, target_post_id) VALUES ('a', $1)
	`, postID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO reports (reporter_sub, target_user_sub, target_post_id) VALUES ('a', 'b', $1)
	`, postID); err == nil {
		t.Fatal("un signalement à deux cibles doit être refusé")
	}
}

func assertColumns(t *testing.T, ctx context.Context, pool *pgxpool.Pool, table string, want []string) {
	t.Helper()
	rows, err := pool.Query(ctx, `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position
	`, table)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		got = append(got, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(got) != len(want) {
		t.Fatalf("%s colonnes = %v, attendu %v", table, got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s colonnes = %v, attendu %v", table, got, want)
		}
	}
}

func emptyDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	adminURL := os.Getenv("DATABASE_URL")
	if adminURL == "" {
		t.Fatal("DATABASE_URL manquant : la base Postgres de docker compose")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Fatalf("connexion postgres: %v", err)
	}
	t.Cleanup(func() { admin.Close(context.Background()) })

	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	name := "ic_" + hex.EncodeToString(buf)
	ident := pgx.Identifier{name}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+ident); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), `
			SELECT pg_terminate_backend(pid)
			FROM pg_stat_activity
			WHERE datname = $1 AND pid <> pg_backend_pid()
		`, name)
		if _, err := admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+ident); err != nil {
			t.Errorf("suppression de %s: %v", name, err)
		}
	})

	parsed, err := url.Parse(adminURL)
	if err != nil {
		t.Fatal(err)
	}
	parsed.Path = "/" + name
	pool, err := Connect(ctx, parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}
