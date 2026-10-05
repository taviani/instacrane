package main

import (
	"context"
	"log"
	"net/http"

	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/config"
	"github.com/taviani/instacrane/server/internal/db"
	api "github.com/taviani/instacrane/server/internal/http"
	"github.com/taviani/instacrane/server/internal/media"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}
	sessions, err := auth.NewVerifier(ctx, cfg.IssuerURL)
	if err != nil {
		log.Fatal(err)
	}
	objects, err := media.NewStore(cfg.Storage)
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{
		Addr: cfg.Addr,
		Handler: api.WithCORS(api.WithSite(api.New(api.Deps{
			Pool:     pool,
			Sessions: sessions,
			Objects:  objects,
		}), cfg.WebRoot), cfg.Origins),
	}
	log.Fatal(server.ListenAndServe())
}
