package media

import (
	"image"

	"golang.org/x/image/draw"
)

const (
	DisplayEdge = 1440
	ThumbEdge   = 480
)

func PhotoJPEGs(raw []byte) (display, thumb []byte, err error) {
	src, err := decodePhoto(raw)
	if err != nil {
		return nil, nil, errPhoto
	}
	portrait := fitPortrait(src)
	display, err = encodeJPEG(portrait)
	if err != nil {
		return nil, nil, err
	}
	thumb, err = encodeJPEG(squareThumb(portrait))
	if err != nil {
		return nil, nil, err
	}
	return display, thumb, nil
}

func fitPortrait(src image.Image) image.Image {
	width, height := portraitSize(src.Bounds().Dx(), src.Bounds().Dy())
	cropped := cropCenter(src, width, height)
	if height <= DisplayEdge {
		return cropped
	}
	return scaleTo(cropped, DisplayEdge*4/5, DisplayEdge)
}

func squareThumb(src image.Image) image.Image {
	side := src.Bounds().Dx()
	if src.Bounds().Dy() < side {
		side = src.Bounds().Dy()
	}
	cropped := cropCenter(src, side, side)
	if side <= ThumbEdge {
		return cropped
	}
	return scaleTo(cropped, ThumbEdge, ThumbEdge)
}

func portraitSize(width, height int) (int, int) {
	if width*5 >= height*4 {
		narrow := height * 4 / 5
		if narrow < 1 {
			narrow = 1
		}
		if narrow > width {
			narrow = width
		}
		return narrow, height
	}
	tall := width * 5 / 4
	if tall < 1 {
		tall = 1
	}
	if tall > height {
		tall = height
	}
	return width, tall
}

func cropCenter(src image.Image, width, height int) image.Image {
	bounds := src.Bounds()
	x0 := bounds.Min.X + (bounds.Dx()-width)/2
	y0 := bounds.Min.Y + (bounds.Dy()-height)/2
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(dst, dst.Bounds(), src, image.Pt(x0, y0), draw.Src)
	return dst
}

func scaleTo(src image.Image, width, height int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}
