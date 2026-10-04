package api

import (
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (deps Deps) cards(r *http.Request, rows pgx.Rows) ([]person, error) {
	cards := []person{}
	for rows.Next() {
		var card person
		var key *string
		if err := rows.Scan(&card.Username, &card.DisplayName, &card.Bio, &key); err != nil {
			return nil, err
		}
		var err error
		card.AvatarURL, err = deps.signed(r.Context(), key)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return cards, nil
}
