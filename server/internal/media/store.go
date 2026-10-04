package media

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/taviani/instacrane/server/internal/config"
)

const signFor = 5 * time.Minute

type Store struct {
	bucket string
	client *s3.Client
	sign   *s3.PresignClient
}

func NewStore(cfg config.Storage) (*Store, error) {
	client := s3.New(s3.Options{
		Region:       "us-east-1",
		BaseEndpoint: aws.String(cfg.Endpoint),
		UsePathStyle: true,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	})
	return &Store{
		bucket: cfg.Bucket,
		client: client,
		sign:   s3.NewPresignClient(client),
	}, nil
}

func (s *Store) EnsureBucket(ctx context.Context) error {
	_, err := s.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(s.bucket)})
	if err == nil {
		return nil
	}
	var owned *types.BucketAlreadyOwnedByYou
	var exists *types.BucketAlreadyExists
	if errors.As(err, &owned) || errors.As(err, &exists) {
		return nil
	}
	return fmt.Errorf("conteneur: %w", err)
}

func (s *Store) PutAvatar(ctx context.Context, body []byte) (string, error) {
	key, err := randomKey("avatars/")
	if err != nil {
		return "", err
	}
	if err := s.putJPEG(ctx, key, body); err != nil {
		return "", fmt.Errorf("envoi avatar: %w", err)
	}
	return key, nil
}

func (s *Store) PutPhoto(ctx context.Context, display, thumb []byte) (string, string, error) {
	displayKey, err := randomKey("photos/")
	if err != nil {
		return "", "", err
	}
	thumbKey, err := randomKey("thumbs/")
	if err != nil {
		return "", "", err
	}
	if err := s.putJPEG(ctx, displayKey, display); err != nil {
		return "", "", fmt.Errorf("envoi photo: %w", err)
	}
	if err := s.putJPEG(ctx, thumbKey, thumb); err != nil {
		_ = s.Delete(ctx, displayKey)
		return "", "", fmt.Errorf("envoi miniature: %w", err)
	}
	return displayKey, thumbKey, nil
}

func (s *Store) putJPEG(ctx context.Context, key string, body []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("image/jpeg"),
	})
	return err
}

func randomKey(prefix string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf) + ".jpg", nil
}

func ownedKey(key string) bool {
	return strings.HasPrefix(key, "avatars/") || strings.HasPrefix(key, "photos/") || strings.HasPrefix(key, "thumbs/")
}

func (s *Store) Delete(ctx context.Context, key string) error {
	if !ownedKey(key) {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("retrait objet: %w", err)
	}
	return nil
}

func (s *Store) Sign(ctx context.Context, key string) (string, error) {
	out, err := s.sign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(signFor))
	if err != nil {
		return "", fmt.Errorf("lien avatar: %w", err)
	}
	return out.URL, nil
}
