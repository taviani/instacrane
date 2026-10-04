package api

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/db"
	"github.com/taviani/instacrane/server/internal/dbtest"
	"github.com/taviani/instacrane/server/internal/testissuer"
)

func TestModeration(t *testing.T) {
	ctx := context.Background()
	pool := dbtest.Pool(t)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	iss := testissuer.Start(t)
	verifier, err := auth.NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(Deps{Pool: pool, Sessions: verifier})
	token := func(sub string) string {
		return iss.Token(t, sub, sub+"@example.test", time.Now().Add(time.Hour))
	}
	for _, sub := range []string{"virginie", "paul", "lea", "sans-nom"} {
		if call(t, handler, http.MethodGet, "/api/users/me", token(sub), "").Code != http.StatusOK {
			t.Fatalf("ouverture %s", sub)
		}
	}
	for _, sub := range []string{"virginie", "paul", "lea"} {
		if call(t, handler, http.MethodPatch, "/api/users/me", token(sub), `{"username":"`+sub+`"}`).Code != http.StatusOK {
			t.Fatalf("nom %s", sub)
		}
	}
	const paulPost = "10000000-0000-4000-8000-000000000021"
	const virginiePost = "10000000-0000-4000-8000-000000000022"
	insertPost(t, pool, "paul", paulPost, time.Date(2026, 4, 2, 0, 0, 0, 0, time.UTC), 0)
	insertPost(t, pool, "virginie", virginiePost, time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC), 0)

	if call(t, handler, http.MethodPost, "/api/users/paul/block", token("sans-nom"), "").Code != http.StatusForbidden {
		t.Fatal("bloquer sans nom")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/block", token("paul"), "").Code != http.StatusBadRequest {
		t.Fatal("se bloquer")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/block", token("virginie"), `{"motif":"non"}`).Code != http.StatusBadRequest {
		t.Fatal("un champ sur le blocage")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("lea"), "").Code != http.StatusCreated {
		t.Fatal("demande de Léa")
	}
	notesBefore := countNotes(t, pool)
	if call(t, handler, http.MethodPost, "/api/users/lea/block", token("paul"), "").Code != http.StatusCreated {
		t.Fatal("bloquer une demande en attente")
	}
	var leaFollow int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM follows WHERE follower_sub = 'lea' AND following_sub = 'paul'`).Scan(&leaFollow); err != nil || leaFollow != 0 {
		t.Fatal("la demande en attente reste")
	}
	if countNotes(t, pool) != notesBefore {
		t.Fatal("bloquer a créé ou retiré une notification")
	}
	refused := call(t, handler, http.MethodPost, "/api/users/paul/follow", token("lea"), "")
	if refused.Code != http.StatusBadRequest || refused.Body["error"] != "demande refusée" {
		t.Fatalf("redemande: %#v", refused.Body)
	}
	if call(t, handler, http.MethodDelete, "/api/users/lea/block", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("débloquer Léa")
	}

	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("demande de Virginie")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("paul"), "").Code != http.StatusOK {
		t.Fatal("Paul accepte")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow", token("paul"), "").Code != http.StatusCreated {
		t.Fatal("demande de Paul")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow/accept", token("virginie"), "").Code != http.StatusOK {
		t.Fatal("Virginie accepte")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+virginiePost+"/like", token("paul"), "").Code != http.StatusCreated {
		t.Fatal("like de Paul")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulPost+"/comments", token("virginie"), `{"body":"vu"}`).Code != http.StatusCreated {
		t.Fatal("commentaire de Virginie")
	}
	var likes, comments int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM likes`).Scan(&likes); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM comments`).Scan(&comments); err != nil {
		t.Fatal(err)
	}
	notes := countNotes(t, pool)

	blocked := call(t, handler, http.MethodPost, "/api/users/virginie/block", token("paul"), "")
	if blocked.Code != http.StatusCreated || blocked.Body["blocked"] != true {
		t.Fatalf("blocage: %d %#v", blocked.Code, blocked.Body)
	}
	again := call(t, handler, http.MethodPost, "/api/users/virginie/block", token("paul"), "")
	if again.Code != http.StatusOK {
		t.Fatal("second blocage")
	}
	var blocks int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM blocks`).Scan(&blocks); err != nil || blocks != 1 {
		t.Fatalf("lignes de blocage = %d", blocks)
	}
	var toPaul, toVirginie int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM follows WHERE follower_sub = 'virginie' AND following_sub = 'paul'`).Scan(&toPaul); err != nil || toPaul != 0 {
		t.Fatal("Virginie suit encore Paul")
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM follows WHERE follower_sub = 'paul' AND following_sub = 'virginie' AND status = 'accepted'`).Scan(&toVirginie); err != nil || toVirginie != 1 {
		t.Fatal("le suivi de Paul vers Virginie a disparu")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))) != 0 {
		t.Fatal("la grille de Paul reste ouverte")
	}
	for _, post := range postsOf(t, call(t, handler, http.MethodGet, "/api/posts/feed", token("virginie"), "")) {
		if post["id"] == paulPost {
			t.Fatal("le fil de Virginie montre Paul")
		}
	}
	if call(t, handler, http.MethodGet, "/api/posts/"+paulPost, token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("Virginie voit le détail")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulPost+"/like", token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("Virginie aime encore")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulPost+"/comments", token("virginie"), `{"body":"encore"}`).Code != http.StatusNotFound {
		t.Fatal("Virginie commente encore")
	}
	paulFeed := postsOf(t, call(t, handler, http.MethodGet, "/api/posts/feed", token("paul"), ""))
	seen := false
	for _, post := range paulFeed {
		if post["id"] == virginiePost {
			seen = true
		}
	}
	if !seen {
		t.Fatal("Paul ne voit plus Virginie")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+virginiePost+"/comments", token("paul"), `{"body":"toujours"}`).Code != http.StatusCreated {
		t.Fatal("Paul ne peut plus commenter")
	}
	var likesAfter, commentsAfter int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM likes`).Scan(&likesAfter); err != nil || likesAfter != likes {
		t.Fatalf("likes %d puis %d", likes, likesAfter)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM comments`).Scan(&commentsAfter); err != nil || commentsAfter != comments+1 {
		t.Fatalf("commentaires %d puis %d", comments, commentsAfter)
	}
	if countNotes(t, pool) < notes {
		t.Fatal("une notification a disparu")
	}
	if countNotes(t, pool) != notes+1 {
		t.Fatalf("le commentaire de Paul n'a pas prévenu, ou le blocage a prévenu: %d", countNotes(t, pool))
	}

	virginieSees := call(t, handler, http.MethodGet, "/api/users/paul", token("virginie"), "")
	if virginieSees.Code != http.StatusOK || virginieSees.Body["username"] != "paul" || virginieSees.Body["blocked"] != false || virginieSees.Body["email"] != nil {
		t.Fatalf("fiche vue par Virginie: %#v", virginieSees.Body)
	}
	paulSees := call(t, handler, http.MethodGet, "/api/users/virginie", token("paul"), "")
	if paulSees.Body["blocked"] != true {
		t.Fatalf("fiche vue par Paul: %#v", paulSees.Body)
	}
	found := call(t, handler, http.MethodGet, "/api/users/search/paul", token("virginie"), "")
	if found.Code != http.StatusOK {
		t.Fatal("la recherche perd Paul")
	}
	users, _ := found.Body["users"].([]any)
	if len(users) != 1 {
		t.Fatalf("recherche: %#v", found.Body)
	}

	if call(t, handler, http.MethodDelete, "/api/users/virginie/block", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("débloquer")
	}
	if call(t, handler, http.MethodDelete, "/api/users/virginie/block", token("paul"), "").Code != http.StatusNotFound {
		t.Fatal("débloquer deux fois")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))) != 0 {
		t.Fatal("débloquer a rouvert les photos")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("Virginie ne peut pas redemander")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("paul"), "").Code != http.StatusOK {
		t.Fatal("nouvelle acceptation")
	}
	if len(postsOf(t, call(t, handler, http.MethodGet, "/api/users/paul/posts", token("virginie"), ""))) != 1 {
		t.Fatal("l'accès ne revient pas après acceptation")
	}

	if call(t, handler, http.MethodPost, "/api/users/paul/report", token("virginie"), `{"motif":"x"}`).Code != http.StatusBadRequest {
		t.Fatal("un motif est gardé")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/report", token("virginie"), "").Code != http.StatusBadRequest {
		t.Fatal("se signaler")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/report", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("signaler Paul")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/report", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("signaler Paul encore")
	}
	var userReports int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM reports
		WHERE reporter_sub = 'virginie' AND target_user_sub = 'paul' AND target_post_id IS NULL
	`).Scan(&userReports); err != nil || userReports != 2 {
		t.Fatalf("signalements de compte = %d", userReports)
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulPost+"/report", token("virginie"), "").Code != http.StatusCreated {
		t.Fatal("signaler la publication")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+virginiePost+"/report", token("virginie"), "").Code != http.StatusBadRequest {
		t.Fatal("signaler sa publication")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/block", token("paul"), "").Code != http.StatusCreated {
		t.Fatal("Paul bloque à nouveau")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+paulPost+"/report", token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("signaler une publication invisible")
	}
	var postReports int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reports WHERE target_post_id = $1`, paulPost).Scan(&postReports); err != nil || postReports != 1 {
		t.Fatalf("signalements de publication = %d", postReports)
	}

	if call(t, handler, http.MethodDelete, "/api/posts/"+paulPost, token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("supprimer la publication")
	}
	var postReportsLeft int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM reports WHERE target_post_id = $1`, paulPost).Scan(&postReportsLeft); err != nil || postReportsLeft != 0 {
		t.Fatal("le signalement de la publication reste")
	}
	if call(t, handler, http.MethodDelete, "/api/users/me", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("supprimer Virginie")
	}
	var left int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM blocks WHERE blocker_sub = 'virginie' OR blocked_sub = 'virginie'
	`).Scan(&left); err != nil || left != 0 {
		t.Fatalf("blocages restants = %d", left)
	}
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM reports WHERE reporter_sub = 'virginie' OR target_user_sub = 'virginie'
	`).Scan(&left); err != nil || left != 0 {
		t.Fatalf("signalements restants = %d", left)
	}
}
