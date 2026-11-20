package mailer

import (
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strings"
	"time"

	"tercerize/backend/internal/config"
)

type Mailer struct {
	cfg config.MailConfig
	log *slog.Logger
}

func New(cfg config.MailConfig, log *slog.Logger) *Mailer {
	return &Mailer{cfg: cfg, log: log}
}

func (m *Mailer) Configured() bool {
	return m.cfg.Host != "" && m.cfg.Username != "" && m.cfg.Password != ""
}

// SendAuthenticatorLink sends an activation link (without QR code) for configuring Google Authenticator.
func (m *Mailer) SendAuthenticatorLink(toEmail, toName, companyName, roleName, activationURL string) error {
	subject := fmt.Sprintf("[%s] Ative seu acesso com Google Authenticator", m.cfg.FromName)
	contextLine := "Seu acesso à plataforma foi habilitado."
	if companyName != "" && roleName != "" {
		contextLine = fmt.Sprintf("Você foi vinculado(a) à empresa <strong>%s</strong> com a função <strong>%s</strong>.", companyName, roleName)
	} else if roleName != "" {
		contextLine = fmt.Sprintf("Seu acesso <strong>%s</strong> foi habilitado na plataforma.", roleName)
	}

	htmlBody := fmt.Sprintf(`<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background-color:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">%s</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;">Olá, <strong>%s</strong>.</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">%s</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">
      Na plataforma <strong>%s</strong>, o acesso é feito exclusivamente com seu <strong>e-mail</strong> e o código de 6 dígitos do <strong>Google Authenticator</strong>. Clique no botão abaixo para configurar seu aplicativo de autenticação e entrar imediatamente:
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="%s" style="display:inline-block;background:linear-gradient(90deg,#3B68F7,#5346E8);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">
        Configurar Google Authenticator e Acessar
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">Se o botão não abrir, copie e cole este link no navegador:</p>
    <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#3B68F7;">%s</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
    <p style="margin:0;font-size:11px;color:#94a3b8;">Este link é pessoal e válido por 24 horas. Não o compartilhe com terceiros.</p>
  </div>
</body>
</html>`, m.cfg.FromName, toName, contextLine, m.cfg.FromName, activationURL, activationURL)

	if !m.Configured() {
		m.log.Warn("SMTP não configurado; exibindo link de ativação no log", "to", toEmail, "url", activationURL)
		return nil
	}

	return m.sendHTML(toEmail, subject, htmlBody)
}

func (m *Mailer) sendHTML(toEmail, subject, htmlBody string) error {
	fromAddr := m.cfg.FromAddress
	if fromAddr == "" {
		fromAddr = m.cfg.Username
	}
	fromHeader := fmt.Sprintf("%s <%s>", m.cfg.FromName, fromAddr)

	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s\r\n", fromHeader))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := net.JoinHostPort(m.cfg.Host, m.cfg.Port)
	auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	tlsCfg := &tls.Config{ServerName: m.cfg.Host, MinVersion: tls.VersionTLS12}

	var client *smtp.Client
	var err error

	if m.cfg.Encryption == "ssl" || m.cfg.Port == "465" {
		dialer := &net.Dialer{Timeout: 10 * time.Second}
		conn, dialErr := tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
		if dialErr != nil {
			return fmt.Errorf("conectar SMTP SSL (%s): %w", addr, dialErr)
		}
		client, err = smtp.NewClient(conn, m.cfg.Host)
		if err != nil {
			conn.Close()
			return fmt.Errorf("iniciar cliente SMTP SSL: %w", err)
		}
	} else {
		conn, dialErr := net.DialTimeout("tcp", addr, 10*time.Second)
		if dialErr != nil {
			return fmt.Errorf("conectar SMTP (%s): %w", addr, dialErr)
		}
		client, err = smtp.NewClient(conn, m.cfg.Host)
		if err != nil {
			conn.Close()
			return fmt.Errorf("iniciar cliente SMTP: %w", err)
		}
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(tlsCfg); err != nil {
				client.Close()
				return fmt.Errorf("STARTTLS: %w", err)
			}
		}
	}
	defer client.Close()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("autenticar SMTP: %w", err)
	}
	if err := client.Mail(fromAddr); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}
	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("RCPT TO: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}
	if _, err := w.Write([]byte(msg.String())); err != nil {
		return fmt.Errorf("escrever corpo SMTP: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("fechar corpo SMTP: %w", err)
	}
	return client.Quit()
}
