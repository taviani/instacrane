ALTER TABLE users DROP CONSTRAINT users_username_format;

ALTER TABLE users
    ADD CONSTRAINT users_username_format CHECK (
        username IS NULL OR username ~ '^[A-Za-z0-9_.]{2,30}$'
    );
