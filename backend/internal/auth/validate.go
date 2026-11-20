package auth

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

type FieldErrors map[string][]string

type RegisterInput struct {
	CompanyName string `json:"companyName"`
	CNPJ        string `json:"cnpj"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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

func normalizeEmail(raw string) (string, string) {
	email := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case len(email) > 254:
		return email, "Use até 254 caracteres."
	case strings.HasPrefix(email, "."), strings.Contains(email, ".."), !emailShape.MatchString(email):
		return email, "Informe um e-mail válido."
	}
	return email, ""
}

func ValidateRegister(in RegisterInput) (RegisterInput, FieldErrors) {
	errs := FieldErrors{}
	in.CompanyName = strings.TrimSpace(in.CompanyName)
	if len([]rune(in.CompanyName)) < 2 {
		errs["companyName"] = []string{"Informe a razão social da empresa (mínimo 2 caracteres)."}
	} else if len([]rune(in.CompanyName)) > 120 {
		errs["companyName"] = []string{"Use até 120 caracteres."}
	}

	formattedCNPJ, cnpjErr := ValidateCNPJ(in.CNPJ)
	in.CNPJ = formattedCNPJ
	if cnpjErr != "" {
		errs["cnpj"] = []string{cnpjErr}
	}

	in.Name = strings.TrimSpace(in.Name)
	if n := len([]rune(in.Name)); n < 2 {
		errs["name"] = []string{"Informe o nome do gestor (mínimo 2 letras)."}
	} else if n > 80 {
		errs["name"] = []string{"Use até 80 caracteres."}
	}
	email, msg := normalizeEmail(in.Email)
	in.Email = email
	if msg != "" {
		errs["email"] = []string{msg}
	}
	if n := len([]rune(in.Password)); n < 6 {
		errs["password"] = []string{"A senha precisa ter ao menos 6 caracteres."}
	} else if n > 128 {
		errs["password"] = []string{"Use até 128 caracteres."}
	}
	if len(errs) == 0 {
		return in, nil
	}
	return in, errs
}

func ValidateLogin(in LoginInput) (LoginInput, FieldErrors) {
	errs := FieldErrors{}
	email, msg := normalizeEmail(in.Email)
	in.Email = email
	if msg != "" {
		errs["email"] = []string{msg}
	}
	if in.Password == "" {
		errs["password"] = []string{"Informe a senha."}
	} else if len([]rune(in.Password)) > 128 {
		errs["password"] = []string{"Use até 128 caracteres."}
	}
	if len(errs) == 0 {
		return in, nil
	}
	return in, errs
}
