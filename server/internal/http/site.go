package api

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func WithSite(next http.Handler, root string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api" {
			next.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		name, ok := siteFile(root, r.URL.Path)
		if !ok {
			http.NotFound(w, r)
			return
		}
		file, err := os.Open(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil || !info.Mode().IsRegular() {
			http.NotFound(w, r)
			return
		}
		http.ServeContent(w, r, info.Name(), info.ModTime(), file)
	})
}

func siteFile(root, requestPath string) (string, bool) {
	root = strings.TrimSpace(root)
	if root == "" {
		return "", false
	}
	rel := strings.TrimPrefix(path.Clean("/"+requestPath), "/")
	candidate := "index.html"
	if rel != "" && rel != "." {
		candidate = rel
	}
	full := filepath.Join(root, filepath.FromSlash(candidate))
	if !inside(root, full) {
		return "", false
	}
	if regular(full) {
		return full, true
	}
	index := filepath.Join(root, "index.html")
	if regular(index) {
		return index, true
	}
	return "", false
}

func inside(root, full string) bool {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	fullAbs, err := filepath.Abs(full)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, fullAbs)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func regular(name string) bool {
	info, err := os.Stat(name)
	return err == nil && info.Mode().IsRegular()
}
