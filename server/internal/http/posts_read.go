package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (deps Deps) feed(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	limit, beforeAt, beforeID, ok := postPage(w, r)
	if !ok {
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT p.id, p.caption, p.latitude, p.longitude, p.created_at,
		       u.username, u.display_name, u.avatar_key,
		       (SELECT count(*) FROM likes WHERE post_id = p.id),
		       (SELECT count(*) FROM comments WHERE post_id = p.id),
		       EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_sub = $1),
		       (SELECT c.body FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1),
		       (SELECT cu.username FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1)
		FROM posts p
		JOIN users u ON u.sub = p.author_sub
		WHERE (
			p.author_sub = $1
			OR (
				EXISTS (
					SELECT 1 FROM follows
					WHERE follower_sub = $1 AND following_sub = p.author_sub AND status = 'accepted'
				)
				AND NOT EXISTS (
					SELECT 1 FROM blocks
					WHERE blocker_sub = p.author_sub AND blocked_sub = $1
				)
			)
		)
		  AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2, $3::uuid))
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT $4
	`, session.Sub, beforeAt, beforeID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	defer rows.Close()
	posts := []postView{}
	for rows.Next() {
		view, avatarKey, err := scanPost(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "publication indisponible")
			return
		}
		view.Author.AvatarURL, err = deps.signed(r.Context(), avatarKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "publication indisponible")
			return
		}
		if err := deps.attachPhotos(r.Context(), &view); err != nil {
			writeError(w, http.StatusInternalServerError, "publication indisponible")
			return
		}
		posts = append(posts, view)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (deps Deps) postDetail(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	view, err := deps.readPost(r.Context(), session.Sub, r.PathValue("id"), true)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "publication introuvable")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (deps Deps) readPost(ctx context.Context, viewer, id string, withComments bool) (postView, error) {
	if !uuidPattern.MatchString(id) {
		return postView{}, pgx.ErrNoRows
	}
	row := deps.Pool.QueryRow(ctx, `
		SELECT p.id, p.caption, p.latitude, p.longitude, p.created_at,
		       u.username, u.display_name, u.avatar_key,
		       (SELECT count(*) FROM likes WHERE post_id = p.id),
		       (SELECT count(*) FROM comments WHERE post_id = p.id),
		       EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_sub = $2),
		       (SELECT c.body FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1),
		       (SELECT cu.username FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1)
		FROM posts p
		JOIN users u ON u.sub = p.author_sub
		WHERE p.id = $1
		  AND (
		    p.author_sub = $2
		    OR (
		      EXISTS (
		        SELECT 1 FROM follows
		        WHERE follower_sub = $2 AND following_sub = p.author_sub AND status = 'accepted'
		      )
		      AND NOT EXISTS (
		        SELECT 1 FROM blocks
		        WHERE blocker_sub = p.author_sub AND blocked_sub = $2
		      )
		    )
		  )
	`, id, viewer)
	view, avatarKey, err := scanPost(row)
	if err != nil {
		return postView{}, err
	}
	if err := deps.attachPhotos(ctx, &view); err != nil {
		return postView{}, err
	}
	view.Author.AvatarURL, err = deps.signed(ctx, avatarKey)
	if err != nil {
		return postView{}, err
	}
	if withComments {
		view.Comments, err = deps.commentsOf(ctx, id, 30, nil, nil)
		if err != nil {
			return postView{}, err
		}
	}
	return view, nil
}

func scanPost(row pgx.Row) (postView, *string, error) {
	var view postView
	var username *string
	var avatar *string
	err := row.Scan(
		&view.ID, &view.Caption, &view.Latitude, &view.Longitude, &view.CreatedAt,
		&username, &view.Author.DisplayName, &avatar,
		&view.LikesCount, &view.CommentsCount, &view.Liked,
		&view.PreviewBody, &view.PreviewUsername,
	)
	if err != nil {
		return postView{}, nil, err
	}
	if username != nil {
		view.Author.Username = *username
	}
	view.Photos = []photoView{}
	return view, avatar, nil
}

func (deps Deps) attachPhotos(ctx context.Context, view *postView) error {
	rows, err := deps.Pool.Query(ctx, `
		SELECT position, display_key
		FROM post_photos
		WHERE post_id = $1
		ORDER BY position
	`, view.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	photos := []photoView{}
	for rows.Next() {
		var photo photoView
		var key string
		if err := rows.Scan(&photo.Position, &key); err != nil {
			return err
		}
		url, err := deps.signed(ctx, &key)
		if err != nil {
			return err
		}
		if url != nil {
			photo.URL = *url
		}
		photos = append(photos, photo)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	view.Photos = photos
	return nil
}

func (deps Deps) searchVisiblePosts(ctx context.Context, viewer, pattern string) ([]postView, error) {
	rows, err := deps.Pool.Query(ctx, `
		SELECT p.id, p.caption, p.latitude, p.longitude, p.created_at,
		       u.username, u.display_name, u.avatar_key,
		       (SELECT count(*) FROM likes WHERE post_id = p.id),
		       (SELECT count(*) FROM comments WHERE post_id = p.id),
		       EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_sub = $1),
		       (SELECT c.body FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1),
		       (SELECT cu.username FROM comments c JOIN users cu ON cu.sub = c.author_sub
		         WHERE c.post_id = p.id AND cu.username IS NOT NULL
		         ORDER BY c.created_at ASC, c.id ASC LIMIT 1)
		FROM posts p
		JOIN users u ON u.sub = p.author_sub
		WHERE p.caption ILIKE $2 ESCAPE '!'
		  AND (
		    p.author_sub = $1
		    OR (
		      EXISTS (
		        SELECT 1 FROM follows
		        WHERE follower_sub = $1 AND following_sub = p.author_sub AND status = 'accepted'
		      )
		      AND NOT EXISTS (
		        SELECT 1 FROM blocks
		        WHERE blocker_sub = p.author_sub AND blocked_sub = $1
		      )
		    )
		  )
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT 20
	`, viewer, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	posts := []postView{}
	for rows.Next() {
		view, avatarKey, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		view.Author.AvatarURL, err = deps.signed(ctx, avatarKey)
		if err != nil {
			return nil, err
		}
		if err := deps.attachPhotos(ctx, &view); err != nil {
			return nil, err
		}
		posts = append(posts, view)
	}
	return posts, rows.Err()
}

func (deps Deps) listLikes(w http.ResponseWriter, r *http.Request) {
	session, ok := deps.session(w, r)
	if !ok {
		return
	}
	if _, err := deps.readPost(r.Context(), session.Sub, r.PathValue("id"), false); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "publication introuvable")
			return
		}
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	rows, err := deps.Pool.Query(r.Context(), `
		SELECT u.username, u.display_name, u.bio, u.avatar_key
		FROM likes l
		JOIN users u ON u.sub = l.user_sub
		WHERE l.post_id = $1 AND u.username IS NOT NULL
		ORDER BY l.created_at DESC, u.username
		LIMIT 100
	`, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	defer rows.Close()
	cards, err := deps.cards(r, rows)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "publication indisponible")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": cards})
}
