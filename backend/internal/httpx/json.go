package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const maxBody = 64 << 10

func Write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func Message(w http.ResponseWriter, status int, text string) {
	Write(w, status, map[string]string{"message": text})
}

func Read(r *http.Request, v any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
	if err != nil {
		return err
	}
	if len(body) > maxBody {
		return errors.New("corpo grande demais")
	}
	if len(body) == 0 {
		return errors.New("corpo vazio")
	}
	return json.Unmarshal(body, v)
}
