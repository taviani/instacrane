package auth

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
)

type Session struct {
	Sub   string
	Email *string
}

type Verifier struct {
	tokens *oidc.IDTokenVerifier
}

func NewVerifier(ctx context.Context, issuer string) (*Verifier, error) {
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("issuer: %w", err)
	}
	// L'identifiant de client reste hors du dépôt. L'API vérifie l'issuer.
	return &Verifier{
		tokens: provider.Verifier(&oidc.Config{SkipClientIDCheck: true}),
	}, nil
}

func (v *Verifier) Verify(ctx context.Context, raw string) (Session, error) {
	token, err := v.tokens.Verify(ctx, raw)
	if err != nil {
		return Session{}, fmt.Errorf("session refusée: %w", err)
	}
	var claims struct {
		Email string `json:"email"`
	}
	if err := token.Claims(&claims); err != nil {
		return Session{}, fmt.Errorf("session refusée: %w", err)
	}
	session := Session{Sub: token.Subject}
	if claims.Email != "" {
		session.Email = &claims.Email
	}
	return session, nil
}

func ActionRefused(username *string) bool {
	return username == nil || *username == ""
}
