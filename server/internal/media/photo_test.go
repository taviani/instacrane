package media

import (
	"bytes"
	"image"
	"image/jpeg"
	"testing"
)

func TestPhotoJPEGsFitsBothSizes(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2000, 800))
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	display, thumb, err := PhotoJPEGs(raw.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	dw, dh := jpegSize(t, display)
	if dw != 640 || dh != 800 {
		t.Fatalf("affichage = %dx%d", dw, dh)
	}
	tw, th := jpegSize(t, thumb)
	if tw != 480 || th != 480 {
		t.Fatalf("miniature = %dx%d", tw, th)
	}
}

func TestPhotoJPEGsPortraitAndSquare(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 4000, 5000))
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	display, thumb, err := PhotoJPEGs(raw.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	dw, dh := jpegSize(t, display)
	if dw != 1152 || dh != 1440 {
		t.Fatalf("affichage = %dx%d", dw, dh)
	}
	tw, th := jpegSize(t, thumb)
	if tw != 480 || th != 480 {
		t.Fatalf("miniature = %dx%d", tw, th)
	}
}

func TestPhotoJPEGsDropsMarker(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 20, 10))
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, &jpeg.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	payload := []byte("GPSLAT")
	marker := []byte{0xFF, 0xE1, 0, byte(len(payload) + 2)}
	marker = append(marker, payload...)
	encoded := raw.Bytes()
	withMarker := append([]byte{}, encoded[:2]...)
	withMarker = append(withMarker, marker...)
	withMarker = append(withMarker, encoded[2:]...)
	display, _, err := PhotoJPEGs(withMarker)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(display, payload) {
		t.Fatal("la position du fichier est restée")
	}
}

func TestPhotoJPEGsRejectsText(t *testing.T) {
	if _, _, err := PhotoJPEGs([]byte("pas une photo")); err == nil {
		t.Fatal("un fichier qui n'est pas une photo doit être refusé")
	}
}

func jpegSize(t *testing.T, raw []byte) (int, int) {
	t.Helper()
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	return cfg.Width, cfg.Height
}
