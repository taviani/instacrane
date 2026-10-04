package main

import (
	"context"
	"log"
	"net/http"

	"github.com/taviani/instacrane/server/internal/config"
	"github.com/taviani/instacrane/server/internal/db"
	api "github.com/taviani/instacrane/server/internal/http"
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
	server := &http.Server{
		Addr:    cfg.Addr,
		Handler: api.New(),
	}
	log.Fatal(server.ListenAndServe())
}
