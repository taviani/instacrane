ALTER TABLE posts
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE posts
    ADD CONSTRAINT posts_location CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (
            latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90
            AND longitude BETWEEN -180 AND 180
        )
    );

ALTER TABLE posts
    ADD CONSTRAINT posts_caption_len CHECK (
        caption IS NULL OR char_length(caption) <= 2200
    );

ALTER TABLE comments
    ADD CONSTRAINT comments_body_len CHECK (
        char_length(body) BETWEEN 1 AND 1000
    );
