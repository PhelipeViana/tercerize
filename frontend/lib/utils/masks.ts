export { formatCNPJ, validateCNPJ } from "./cnpj";

const EMAIL_RE = /^[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export function validateEmail(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, normalized, error: "Informe o e-mail de contato." };
  }
  if (normalized.length > 254 || normalized.startsWith(".") || normalized.includes("..") || !EMAIL_RE.test(normalized)) {
    return { valid: false, normalized, error: "Informe um e-mail válido (ex.: contato@empresa.com.br)." };
  }
  return { valid: true, normalized };
}

/**
 * Formata telefone brasileiro automaticamente:
 * - 10 dígitos (fixo): (00) 0000-0000
 * - 11 dígitos (celular): (00) 00000-0000
 */
export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function validatePhoneBR(raw: string): { valid: boolean; formatted: string; error?: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) {
    return {
      valid: false,
      formatted: formatPhoneBR(raw),
      error: "Informe um telefone válido com DDD (10 ou 11 dígitos).",
    };
  }
  if (digits.startsWith("0")) {
    return {
      valid: false,
      formatted: formatPhoneBR(digits),
      error: "DDD inválido. Informe um DDD válido com 2 dígitos.",
    };
  }
  if (/^(\d)\1+$/.test(digits)) {
    return {
      valid: false,
      formatted: formatPhoneBR(digits),
      error: "Telefone inválido: dígitos repetidos não são permitidos.",
    };
  }
  return {
    valid: true,
    formatted: formatPhoneBR(digits),
  };
}

/**
 * Máscara monetária BRL em tempo real a partir de dígitos (centavos):
 * Ex.: "1850000" -> "18.500,00" | "15050" -> "150,50" | "" -> ""
 */
export function formatCurrencyBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents) || cents === 0) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyBRL(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", "."));
  }
  return Number(cleaned);
}

/**
 * Formata Certificado de Aprovação de EPI: "42110" -> "CA-42110"
 */
export function formatCANumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";
  return `CA-${digits}`;
}

/**
 * Normaliza SKU de almoxarifado: maiúsculas, letras, números e hífen (ex.: CAB-UTP-CAT6)
 */
export function formatSKU(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, 32);
}

/**
 * Mantém apenas dígitos inteiros (ex.: vigência em meses, quantidades de estoque)
 */
export function formatInteger(raw: string, maxDigits = 6): string {
  return raw.replace(/\D/g, "").slice(0, maxDigits);
}

/**
 * Mantém apenas os 6 dígitos do Google Authenticator (TOTP)
 */
export function formatTOTPCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}
