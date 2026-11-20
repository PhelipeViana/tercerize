package auth

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

type FieldErrors map[string][]string

type LoginInput struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

var emailShape = regexp.MustCompile(`^[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$`)

// ValidateCNPJ validates a Brazilian CNPJ (14 digits, non-repeating, official modulo-11 check digits)
// and returns the canonical formatted string "00.000.000/0000-00".
func ValidateCNPJ(raw string) (string, string) {
	var digits []int
	for _, r := range raw {
		if unicode.IsDigit(r) {
			digits = append(digits, int(r-'0'))
		}
	}
	if len(digits) != 14 {
		return raw, "Informe um CNPJ válido com 14 dígitos (00.000.000/0000-00)."
	}
	allSame := true
	for i := 1; i < 14; i++ {
		if digits[i] != digits[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return raw, "CNPJ inválido: dígitos repetidos não são permitidos."
	}

	w1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	sum1 := 0
	for i := 0; i < 12; i++ {
		sum1 += digits[i] * w1[i]
	}
	d1 := 0
	if rem := sum1 % 11; rem >= 2 {
		d1 = 11 - rem
	}
	if digits[12] != d1 {
		return raw, "CNPJ inválido: dígitos verificadores não conferem."
	}

	w2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	sum2 := 0
	for i := 0; i < 13; i++ {
		sum2 += digits[i] * w2[i]
	}
	d2 := 0
	if rem := sum2 % 11; rem >= 2 {
		d2 = 11 - rem
	}
	if digits[13] != d2 {
		return raw, "CNPJ inválido: dígitos verificadores não conferem."
	}

	formatted := fmt.Sprintf("%d%d.%d%d%d.%d%d%d/%d%d%d%d-%d%d",
		digits[0], digits[1],
		digits[2], digits[3], digits[4],
		digits[5], digits[6], digits[7],
		digits[8], digits[9], digits[10], digits[11],
		digits[12], digits[13],
	)
	return formatted, ""
}

func NormalizeEmail(raw string) (string, string) {
	email := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case len(email) > 254:
		return email, "Use até 254 caracteres."
	case strings.HasPrefix(email, "."), strings.Contains(email, ".."), !emailShape.MatchString(email):
		return email, "Informe um e-mail válido."
	}
	return email, ""
}

func ValidateLogin(in LoginInput) (LoginInput, FieldErrors) {
	errs := FieldErrors{}
	email, msg := NormalizeEmail(in.Email)
	in.Email = email
	if msg != "" {
		errs["email"] = []string{msg}
	}
	digits := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, in.Code)
	in.Code = digits
	if len(digits) != 6 {
		errs["code"] = []string{"Informe o código de 6 dígitos do Google Authenticator."}
	}
	if len(errs) == 0 {
		return in, nil
	}
	return in, errs
}
