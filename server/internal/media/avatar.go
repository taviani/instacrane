package media

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png"
	"math"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var errPhoto = errors.New("fichier photo refusé")

const AvatarEdge = 512

func AvatarJPEG(raw []byte) ([]byte, error) {
	src, err := decodePhoto(raw)
	if err != nil {
		return nil, errPhoto
	}
	return encodeJPEG(fitLongEdge(src, AvatarEdge))
}

func decodePhoto(raw []byte) (image.Image, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png" && format != "webp") {
		return nil, errPhoto
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 8000 || cfg.Height > 8000 {
		return nil, errPhoto
	}
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, errPhoto
	}
	return src, nil
}

func encodeJPEG(src image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, src, &jpeg.Options{Quality: 85}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func fitLongEdge(src image.Image, edge int) image.Image {
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	long := width
	if height > long {
		long = height
	}
	if long <= edge {
		return src
	}
	scale := float64(edge) / float64(long)
	nw := int(math.Round(float64(width) * scale))
	nh := int(math.Round(float64(height) * scale))
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
	return dst
}
