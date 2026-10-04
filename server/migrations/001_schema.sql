CREATE TABLE users (
    sub TEXT PRIMARY KEY,
    email TEXT,
    username TEXT,
    display_name TEXT,
    bio TEXT,
    avatar_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_username_unique UNIQUE (username),
    CONSTRAINT users_username_format CHECK (
        username IS NULL OR username ~ '^[A-Za-z0-9_.]{3,30}$'
    )
);

CREATE TABLE follows (
    follower_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    following_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    PRIMARY KEY (follower_sub, following_sub)
);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE post_photos (
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    display_key TEXT NOT NULL,
    thumbnail_key TEXT NOT NULL,
    PRIMARY KEY (post_id, position),
    CONSTRAINT post_photos_position_range CHECK (position BETWEEN 1 AND 20)
);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE likes (
    user_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    PRIMARY KEY (user_sub, post_id)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    actor_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    type TEXT NOT NULL,
    post_id UUID REFERENCES posts (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT notifications_type CHECK (
        (type = 'follow' AND post_id IS NULL)
        OR (type IN ('like', 'comment') AND post_id IS NOT NULL)
    )
);

CREATE TABLE push_tokens (
    user_sub TEXT PRIMARY KEY REFERENCES users (sub) ON DELETE CASCADE,
    token TEXT NOT NULL
);

CREATE TABLE blocks (
    blocker_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    blocked_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    PRIMARY KEY (blocker_sub, blocked_sub)
);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_sub TEXT NOT NULL REFERENCES users (sub) ON DELETE CASCADE,
    target_user_sub TEXT REFERENCES users (sub) ON DELETE CASCADE,
    target_post_id UUID REFERENCES posts (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reports_one_target CHECK (
        (target_user_sub IS NOT NULL AND target_post_id IS NULL)
        OR (target_user_sub IS NULL AND target_post_id IS NOT NULL)
    )
);
