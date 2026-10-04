package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taviani/instacrane/server/internal/auth"
	"github.com/taviani/instacrane/server/internal/db"
	"github.com/taviani/instacrane/server/internal/dbtest"
	"github.com/taviani/instacrane/server/internal/testissuer"
)

type sentAlert struct {
	token string
	text  string
}

type recordingAlerter struct {
	err   error
	calls []sentAlert
}

func (a *recordingAlerter) Send(_ context.Context, token, text string) error {
	a.calls = append(a.calls, sentAlert{token: token, text: text})
	return a.err
}

func TestNotifications(t *testing.T) {
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
	box := &recordingAlerter{}
	handler := New(Deps{Pool: pool, Sessions: verifier, Alerts: box})
	silent := New(Deps{Pool: pool, Sessions: verifier})
	token := func(sub string) string {
		return iss.Token(t, sub, sub+"@example.test", time.Now().Add(time.Hour))
	}
	for _, sub := range []string{"virginie", "paul", "lea"} {
		if call(t, handler, http.MethodGet, "/api/users/me", token(sub), "").Code != http.StatusOK {
			t.Fatalf("ouverture %s", sub)
		}
		if call(t, handler, http.MethodPatch, "/api/users/me", token(sub), `{"username":"`+sub+`"}`).Code != http.StatusOK {
			t.Fatalf("nom %s", sub)
		}
	}
	const postID = "10000000-0000-4000-8000-000000000010"
	insertPost(t, pool, "paul", postID, time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC), 0)

	if call(t, handler, http.MethodGet, "/api/notifications", "", "").Code != http.StatusUnauthorized {
		t.Fatal("liste sans session")
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow", token("virginie"), "").Code != http.StatusBadRequest {
		t.Fatal("se suivre")
	}
	if countNotes(t, pool) != 0 {
		t.Fatal("se suivre a créé une notification")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/like", token("virginie"), "").Code != http.StatusNotFound {
		t.Fatal("like avant acceptation")
	}

	asked := call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "")
	if asked.Code != http.StatusCreated {
		t.Fatalf("demande: %d", asked.Code)
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusOK {
		t.Fatal("demande en double")
	}
	if countNotes(t, pool) != 1 {
		t.Fatalf("une demande en double a multiplié les notifications: %d", countNotes(t, pool))
	}
	list := call(t, handler, http.MethodGet, "/api/notifications", token("paul"), "")
	got := notesOf(t, list)
	if list.Code != http.StatusOK || list.Body["bell"] != true || len(got) != 1 {
		t.Fatalf("liste: %#v", list.Body)
	}
	if got[0]["type"] != "follow" || got[0]["post_id"] != nil || got[0]["is_read"] != false {
		t.Fatalf("demande: %#v", got[0])
	}
	actor, _ := got[0]["actor"].(map[string]any)
	if actor["username"] != "virginie" {
		t.Fatalf("acteur: %#v", actor)
	}
	raw, _ := json.Marshal(list.Body)
	if bytes.Contains(raw, []byte("example.test")) || bytes.Contains(raw, []byte(`"email"`)) || bytes.Contains(raw, []byte(`"body"`)) || bytes.Contains(raw, []byte(`"sub"`)) || bytes.Contains(raw, []byte(`"caption"`)) {
		t.Fatalf("champs en trop: %s", raw)
	}
	if len(notesOf(t, call(t, handler, http.MethodGet, "/api/notifications", token("virginie"), ""))) != 0 {
		t.Fatal("Virginie voit la demande qu'elle a envoyée")
	}

	if call(t, handler, http.MethodPost, "/api/notifications/read", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("marquer lu")
	}
	read := call(t, handler, http.MethodGet, "/api/notifications", token("paul"), "")
	if read.Body["bell"] != true || notesOf(t, read)[0]["is_read"] != true {
		t.Fatalf("cloche après lecture: %#v", read.Body)
	}
	if call(t, handler, http.MethodPost, "/api/users/virginie/follow/accept", token("paul"), "").Code != http.StatusOK {
		t.Fatal("acceptation")
	}
	if call(t, handler, http.MethodGet, "/api/notifications", token("paul"), "").Body["bell"] != false {
		t.Fatal("la cloche reste marquée sans demande ni non-lu")
	}
	if len(notesOf(t, call(t, handler, http.MethodGet, "/api/notifications", token("virginie"), ""))) != 0 {
		t.Fatal("accepter prévient Virginie")
	}

	ghost := iss.Token(t, "inconnu", "inconnu@example.test", time.Now().Add(time.Hour))
	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", ghost, `{"token":"abc"}`).Code != http.StatusNotFound {
		t.Fatal("jeton sans profil")
	}
	if call(t, handler, http.MethodDelete, "/api/users/me/alert-token", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("retirer un jeton absent")
	}
	for _, body := range []string{"", "{}", `{"token":""}`, `{"token":"  "}`, `{"token":"abc","extra":1}`} {
		if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), body).Code != http.StatusBadRequest {
			t.Fatalf("jeton refusé: %s", body)
		}
	}
	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), `{"token":"`+strings.Repeat("a", maxAlertToken+1)+`"}`).Code != http.StatusBadRequest {
		t.Fatal("jeton trop long")
	}
	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), `{"token":"premier"}`).Code != http.StatusNoContent {
		t.Fatal("enregistrer le jeton")
	}
	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), `{"token":"second"}`).Code != http.StatusNoContent {
		t.Fatal("remplacer le jeton")
	}
	var stored string
	if err := pool.QueryRow(ctx, `SELECT token FROM push_tokens WHERE user_sub = 'paul'`).Scan(&stored); err != nil || stored != "second" {
		t.Fatalf("jeton gardé: %s", stored)
	}

	before := countNotes(t, pool)
	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/like", token("paul"), "").Code != http.StatusCreated {
		t.Fatal("like de soi")
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/comments", token("paul"), `{"body":"moi"}`).Code != http.StatusCreated {
		t.Fatal("commentaire de soi")
	}
	if countNotes(t, pool) != before || len(box.calls) != 0 {
		t.Fatalf("agir sur soi a prévenu: notes %d alertes %d", countNotes(t, pool), len(box.calls))
	}

	liked := call(t, handler, http.MethodPost, "/api/posts/"+postID+"/like", token("virginie"), "")
	if liked.Code != http.StatusCreated || countNotes(t, pool) != before+1 || len(box.calls) != 1 {
		t.Fatalf("like: %d notes %d alertes %d", liked.Code, countNotes(t, pool), len(box.calls))
	}
	if box.calls[0].token != "second" || box.calls[0].text != "virginie a aimé une publication" {
		t.Fatalf("alerte: %#v", box.calls[0])
	}
	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/like", token("virginie"), "").Code != http.StatusOK {
		t.Fatal("second like")
	}
	if countNotes(t, pool) != before+1 || len(box.calls) != 1 {
		t.Fatal("un like déjà posé a créé une seconde notification")
	}

	quiet := len(box.calls)
	storedNotes := countNotes(t, pool)
	if call(t, silent, http.MethodPost, "/api/posts/"+postID+"/comments", token("virginie"), `{"body":"sans alerte"}`).Code != http.StatusCreated {
		t.Fatal("commentaire sans configuration d'alerte")
	}
	if countNotes(t, pool) != storedNotes+1 || len(box.calls) != quiet {
		t.Fatal("l'absence de configuration a bloqué le commentaire ou envoyé une alerte")
	}

	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/comments", token("virginie"), `{"body":"vu","caption":"bonjour"}`).Code != http.StatusBadRequest {
		t.Fatal("un champ en trop sur le commentaire doit être refusé")
	}
	comment := call(t, handler, http.MethodPost, "/api/posts/"+postID+"/comments", token("virginie"), `{"body":"vu"}`)
	if comment.Code != http.StatusCreated || len(box.calls) != quiet+1 {
		t.Fatalf("commentaire: %d alertes %d", comment.Code, len(box.calls))
	}
	text := box.calls[len(box.calls)-1].text
	if text != "virginie a commenté une publication" || strings.Contains(text, "vu") || strings.Contains(text, "@") {
		t.Fatalf("texte d'alerte: %s", text)
	}
	commentID, _ := comment.Body["id"].(string)
	if call(t, handler, http.MethodDelete, "/api/posts/"+postID+"/comments/"+commentID, token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("effacer le commentaire")
	}
	if countNotes(t, pool) != storedNotes+2 {
		t.Fatal("effacer un commentaire a changé les notifications")
	}

	box.err = errors.New("envoi indisponible")
	if call(t, handler, http.MethodDelete, "/api/posts/"+postID+"/like", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("retirer le like")
	}
	if countNotes(t, pool) != storedNotes+2 {
		t.Fatal("retirer le like a retiré la notification")
	}
	failed := len(box.calls)
	again := call(t, handler, http.MethodPost, "/api/posts/"+postID+"/like", token("virginie"), "")
	if again.Code != http.StatusCreated || countNotes(t, pool) != storedNotes+3 || len(box.calls) != failed+1 {
		t.Fatalf("like malgré l'alerte: %d notes %d alertes %d", again.Code, countNotes(t, pool), len(box.calls))
	}
	box.err = nil

	if call(t, handler, http.MethodDelete, "/api/users/me/alert-token", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("retirer le jeton")
	}
	sent := len(box.calls)
	if call(t, handler, http.MethodPost, "/api/posts/"+postID+"/comments", token("virginie"), `{"body":"encore"}`).Code != http.StatusCreated {
		t.Fatal("commentaire sans jeton")
	}
	if len(box.calls) != sent {
		t.Fatal("une alerte est partie sans jeton")
	}

	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), `{"token":"suivi"}`).Code != http.StatusNoContent {
		t.Fatal("jeton pour la demande")
	}
	sentFollow := len(box.calls)
	lea := countNotes(t, pool)
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("lea"), "").Code != http.StatusCreated {
		t.Fatal("demande de Léa")
	}
	if len(box.calls) != sentFollow+1 || box.calls[len(box.calls)-1].token != "suivi" || box.calls[len(box.calls)-1].text != "lea a demandé à vous suivre" {
		t.Fatalf("alerte de demande: %#v", box.calls)
	}
	if call(t, handler, http.MethodDelete, "/api/users/me/alert-token", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("retirer le jeton après la demande")
	}
	if call(t, handler, http.MethodDelete, "/api/users/paul/follow", token("lea"), "").Code != http.StatusNoContent {
		t.Fatal("annulation")
	}
	if countNotes(t, pool) != lea+1 || len(notesOf(t, call(t, handler, http.MethodGet, "/api/notifications", token("lea"), ""))) != 0 {
		t.Fatal("annuler a prévenu Léa ou retiré la notification")
	}
	if call(t, handler, http.MethodPost, "/api/users/paul/follow", token("lea"), "").Code != http.StatusCreated {
		t.Fatal("nouvelle demande")
	}
	if countNotes(t, pool) != lea+2 {
		t.Fatal("une demande après annulation n'a pas prévenu")
	}
	if call(t, handler, http.MethodDelete, "/api/users/lea/follow/request", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("refus")
	}
	if countNotes(t, pool) != lea+2 || len(notesOf(t, call(t, handler, http.MethodGet, "/api/notifications", token("lea"), ""))) != 0 {
		t.Fatal("refuser a prévenu Léa")
	}
	if call(t, handler, http.MethodGet, "/api/notifications", token("paul"), "").Body["bell"] != true {
		t.Fatal("une notification non lue ne marque pas la cloche")
	}

	if call(t, handler, http.MethodDelete, "/api/users/paul/follow", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("se désabonner")
	}
	if len(notesOf(t, call(t, handler, http.MethodGet, "/api/notifications", token("virginie"), ""))) != 0 {
		t.Fatal("se désabonner a créé une notification")
	}

	page := call(t, handler, http.MethodGet, "/api/notifications?limit=1", token("paul"), "")
	first := notesOf(t, page)
	if len(first) != 1 {
		t.Fatalf("page: %#v", page.Body)
	}
	older := call(t, handler, http.MethodGet, "/api/notifications?limit=1&before="+url.QueryEscape(first[0]["created_at"].(string)+"|"+first[0]["id"].(string)), token("paul"), "")
	second := notesOf(t, older)
	if len(second) != 1 || second[0]["id"] == first[0]["id"] {
		t.Fatalf("page suivante: %#v", second)
	}
	if call(t, handler, http.MethodGet, "/api/notifications?limit=51", token("paul"), "").Code != http.StatusBadRequest {
		t.Fatal("page trop grande")
	}
	if call(t, handler, http.MethodGet, "/api/notifications?before=hier", token("paul"), "").Code != http.StatusBadRequest {
		t.Fatal("curseur invalide")
	}

	if call(t, handler, http.MethodPut, "/api/users/me/alert-token", token("paul"), `{"token":"encore-la"}`).Code != http.StatusNoContent {
		t.Fatal("jeton avant suppression du compte")
	}
	if call(t, handler, http.MethodDelete, "/api/users/me", token("virginie"), "").Code != http.StatusNoContent {
		t.Fatal("suppression de Virginie")
	}
	var actorLeft int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE actor_sub = 'virginie'`).Scan(&actorLeft); err != nil || actorLeft != 0 {
		t.Fatalf("notifications d'actrice restantes: %d", actorLeft)
	}
	if call(t, handler, http.MethodDelete, "/api/users/me", token("paul"), "").Code != http.StatusNoContent {
		t.Fatal("suppression de Paul")
	}
	var tokenLeft, recipientLeft int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM push_tokens WHERE user_sub = 'paul'`).Scan(&tokenLeft); err != nil || tokenLeft != 0 {
		t.Fatalf("jeton restant: %d", tokenLeft)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE recipient_sub = 'paul'`).Scan(&recipientLeft); err != nil || recipientLeft != 0 {
		t.Fatalf("notifications restantes: %d", recipientLeft)
	}

	if alertText("like", nil) != "Quelqu'un a aimé une publication" {
		t.Fatal("texte sans nom")
	}
	blank := ""
	if alertText("comment", &blank) != "Quelqu'un a commenté une publication" {
		t.Fatal("texte pour un nom vide")
	}
	who := "paul"
	if alertText("follow", &who) != "paul a demandé à vous suivre" {
		t.Fatal("texte de demande")
	}
}

func countNotes(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM notifications`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func notesOf(t *testing.T, res recorded) []map[string]any {
	t.Helper()
	raw, _ := res.Body["notifications"].([]any)
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		note, _ := item.(map[string]any)
		out = append(out, note)
	}
	return out
}
