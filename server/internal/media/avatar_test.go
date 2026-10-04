package media

import (
	"bytes"
	"image"
	"image/jpeg"
	"testing"
)

func TestAvatarJPEGShrinksAndDropsExtras(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 1000, 400))
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	out, err := AvatarJPEG(raw.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if format != "jpeg" {
		t.Fatalf("format = %s", format)
	}
	if cfg.Width != 512 || cfg.Height != 205 {
		t.Fatalf("taille = %dx%d", cfg.Width, cfg.Height)
	}
}

func TestAvatarJPEGRejectsText(t *testing.T) {
	if _, err := AvatarJPEG([]byte("pas une photo")); err == nil {
		t.Fatal("un fichier qui n'est pas une photo doit être refusé")
	}
}
