const FIELD_LABELS: Record<string, string> = {
  email: 'E-mail',
  password: 'Senha',
  password_confirmation: 'Confirmação de senha',
  passwordConfirmation: 'Confirmação de senha'
};

const MESSAGE_PT: Record<string, string> = {
  'has already been taken': 'já está em uso',
  'already been taken': 'já está em uso',
  "can't be blank": 'não pode ficar em branco',
  'is invalid': 'é inválido',
  'is too short (minimum is 8 characters)': 'deve ter ao menos 8 caracteres',
  'is too short': 'é muito curta',
  'is too long': 'é muito longa',
  'does not match': 'não confere',
  'invalid credentials': 'E-mail ou senha inválidos',
  'invalid email or password': 'E-mail ou senha inválidos',
  'unauthorized': 'E-mail ou senha inválidos',
  'forbidden': 'Você não tem permissão para esta ação',
  'not found': 'não encontrado',
  'must exist': 'deve existir',
  'record invalid': 'dados inválidos'
};

function looksEnglish(text: string): boolean {
  return /\b(the|and|is|invalid|already|taken|blank|password|email|user|error|unauthorized|forbidden|not found|unprocessable|must exist|record invalid)\b/i.test(text);
}

function translateMessage(message: string): string {
  const trimmed = (message || '').trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (MESSAGE_PT[lower]) return MESSAGE_PT[lower];
  for (const [en, pt] of Object.entries(MESSAGE_PT)) {
    if (lower.includes(en)) return pt;
  }
  return looksEnglish(trimmed) ? '' : trimmed;
}

function asMessages(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => asMessages(item));
  }
  if (typeof value === 'string') {
    const translated = translateMessage(value);
    return translated ? [translated] : [];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(item => asMessages(item));
  }
  return [];
}

function isFieldMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function collectFieldErrors(source: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isFieldMap(source)) return errors;

  const nested = source['errors'];
  const maps = [source, isFieldMap(nested) ? nested : null].filter(Boolean) as Record<string, unknown>[];

  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      if (['error', 'errors', 'message', 'status', 'exception', 'backtrace'].includes(key)) continue;
      const messages = asMessages(value);
      if (messages.length) {
        errors[key] = messages.join(', ');
      }
    }
  }
  return errors;
}

function collectSummary(source: unknown, fieldErrors: Record<string, string>): string[] {
  const parts: string[] = [];
  if (typeof source === 'string') {
    const translated = translateMessage(source);
    if (translated && !translated.startsWith('<')) parts.push(translated);
    return parts;
  }
  if (!isFieldMap(source)) return parts;

  for (const key of ['error', 'message', 'error_description']) {
    parts.push(...asMessages(source[key]));
  }
  if (typeof source['errors'] === 'string' || Array.isArray(source['errors'])) {
    parts.push(...asMessages(source['errors']));
  }

  for (const [key, message] of Object.entries(fieldErrors)) {
    const label = FIELD_LABELS[key] || key;
    parts.push(`${label}: ${message}`);
  }
  return [...new Set(parts.filter(Boolean))];
}

export function parseFieldErrors(err: any): Record<string, string> {
  return collectFieldErrors(err?.error ?? err);
}

export function parseApiError(err: any, fallback: string): string {
  if (!err || err.status === 0) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  const body = err.error;
  const fieldErrors = collectFieldErrors(body);
  const summary = collectSummary(body, fieldErrors);
  if (summary.length) return summary.join(' ');

  if (err.status === 401 || err.status === 403) {
    return 'E-mail ou senha inválidos';
  }
  return fallback;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}
