export function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function validateCNPJ(raw: string): { valid: boolean; formatted: string; error?: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) {
    return {
      valid: false,
      formatted: formatCNPJ(raw),
      error: "Informe um CNPJ válido com 14 dígitos (00.000.000/0000-00).",
    };
  }
  if (/^(\d)\1{13}$/.test(digits)) {
    return {
      valid: false,
      formatted: formatCNPJ(digits),
      error: "CNPJ inválido: dígitos repetidos não são permitidos.",
    };
  }

  const nums = digits.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) sum1 += nums[i] * w1[i];
  const rem1 = sum1 % 11;
  const d1 = rem1 < 2 ? 0 : 11 - rem1;
  if (nums[12] !== d1) {
    return {
      valid: false,
      formatted: formatCNPJ(digits),
      error: "CNPJ inválido: dígitos verificadores não conferem.",
    };
  }

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) sum2 += nums[i] * w2[i];
  const rem2 = sum2 % 11;
  const d2 = rem2 < 2 ? 0 : 11 - rem2;
  if (nums[13] !== d2) {
    return {
      valid: false,
      formatted: formatCNPJ(digits),
      error: "CNPJ inválido: dígitos verificadores não conferem.",
    };
  }

  return {
    valid: true,
    formatted: formatCNPJ(digits),
  };
}
