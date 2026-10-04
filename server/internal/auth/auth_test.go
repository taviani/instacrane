package auth

import (
	"context"
	"testing"
	"time"

	"github.com/taviani/instacrane/server/internal/testissuer"
)

func TestVerifySession(t *testing.T) {
	ctx := context.Background()
	iss := testissuer.Start(t)
	verifier, err := NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	raw := iss.Token(t, "user-1", "a@example.test", time.Now().Add(time.Hour))
	session, err := verifier.Verify(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	if session.Sub != "user-1" {
		t.Fatalf("sub = %s", session.Sub)
	}
	if session.Email == nil || *session.Email != "a@example.test" {
		t.Fatalf("email = %v", session.Email)
	}
}

func TestVerifySessionWithoutEmail(t *testing.T) {
	ctx := context.Background()
	iss := testissuer.Start(t)
	verifier, err := NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	raw := iss.Token(t, "user-1", "", time.Now().Add(time.Hour))
	session, err := verifier.Verify(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	if session.Email != nil {
		t.Fatalf("email = %v", session.Email)
	}
}

func TestVerifyRejectsOtherIssuer(t *testing.T) {
	ctx := context.Background()
	iss := testissuer.Start(t)
	other := testissuer.Start(t)
	verifier, err := NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	raw := other.Token(t, "user-1", "a@example.test", time.Now().Add(time.Hour))
	if _, err := verifier.Verify(ctx, raw); err == nil {
		t.Fatal("une session d'un autre issuer doit être refusée")
	}
}

func TestVerifyRejectsExpiredSession(t *testing.T) {
	ctx := context.Background()
	iss := testissuer.Start(t)
	verifier, err := NewVerifier(ctx, iss.URL)
	if err != nil {
		t.Fatal(err)
	}
	raw := iss.Token(t, "user-1", "", time.Now().Add(-time.Hour))
	if _, err := verifier.Verify(ctx, raw); err == nil {
		t.Fatal("une session expirée doit être refusée")
	}
}

func TestActionRefusedUntilUsername(t *testing.T) {
	if !ActionRefused(nil) {
		t.Fatal("sans nom, publier, commenter ou suivre doit être refusé")
	}
	empty := ""
	if !ActionRefused(&empty) {
		t.Fatal("un nom vide doit être refusé")
	}
	name := "ada"
	if ActionRefused(&name) {
		t.Fatal("un nom posé doit autoriser l'action")
	}
}
