ALTER TABLE follows
    ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE follows
    ADD CONSTRAINT follows_status CHECK (status IN ('pending', 'accepted'));

ALTER TABLE users
    ADD CONSTRAINT users_username_reserved CHECK (
        username IS NULL OR username NOT IN ('me', 'search')
    );

ALTER TABLE users
    ADD CONSTRAINT users_display_name_len CHECK (
        display_name IS NULL OR char_length(display_name) <= 80
    );

ALTER TABLE users
    ADD CONSTRAINT users_bio_len CHECK (
        bio IS NULL OR char_length(bio) <= 300
    );
