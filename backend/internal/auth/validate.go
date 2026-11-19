package auth

import (
	"regexp"
	"strings"
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
	if in.CompanyName == "" {
		in.CompanyName = "Nova Empresa Terceirizadora"
	}
	in.CNPJ = strings.TrimSpace(in.CNPJ)
	if in.CNPJ == "" {
		in.CNPJ = "00.000.000/0001-00"
	}
	in.Name = strings.TrimSpace(in.Name)
	if n := len([]rune(in.Name)); n < 2 {
		errs["name"] = []string{"Informe seu nome (mínimo 2 letras)."}
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
