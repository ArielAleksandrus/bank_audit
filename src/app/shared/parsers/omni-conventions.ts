import { PAYMENT_TYPES } from '../models/purchase';

/**
 * Conventions collected from the hand-written bank parsers
 * (Sicoob, Stone, Sicredi, Itaú, BRB). Used by OmniParser.
 */

export const MIN_DESC_LETTERS = 7;

export type IncomeType = 'cartao'|'pix'|'deposito'|'cheque'|'outros';
export type MoneyParse = {
	amount: number;
	signed: number;
	debitHint: boolean|null;
};

export function foldPt(text: string): string {
	return String(text || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function letterCount(text: string): number {
	return (String(text || '').match(/\p{L}/gu) || []).length;
}

export function cellStr(cell: any): string {
	if(cell == null)
		return '';
	if(typeof cell == 'string')
		return cell.trim();
	if(cell instanceof Date)
		return '';
	return String(cell).trim();
}

const HEADER_ALIASES: {[role: string]: string[]} = {
	date: ['data', 'date', 'dtposted', 'data lancamento', 'data do lancamento', 'data movimento', 'data da movimentacao', 'data movimentacao'],
	value: ['valor', 'value', 'trnamt', 'valor r', 'vlr', 'valor da movimentacao'],
	saldo: ['saldo', 'saldo atual', 'saldo depois', 'saldo antes', 'saldo final', 'balance', 'saldo do dia'],
	debit: ['debito', 'debitos', 'debit', 'valor debito'],
	credit: ['credito', 'creditos', 'credit', 'valor credito'],
	desc: ['historico', 'descricao', 'memo', 'lancamento', 'lancamentos', 'tipo', 'historico / lancamento', 'descricao da movimentacao'],
	doc: ['documento', 'document', 'fitid', 'refnum', 'nro doc', 'n doc', 'nr documento', 'id', 'identificacao'],
	origin: ['origem', 'pagador', 'remetente', 'nome origem', 'razao social'],
	dest: ['destino', 'favorecido', 'beneficiario', 'nome destino', 'destinatario'],
	move: ['movimentacao', 'natureza', 'c/d', 'd/c', 'dc', 'tipo movimento', 'situacao'],
	extraName: ['informacoes complementares', 'complemento', 'detalhes', 'observacao', 'observacoes', 'historico complementar']
};

export type HeaderRole = keyof typeof HEADER_ALIASES | 'none';

function normHeader(text: string): string {
	return foldPt(text).replace(/[^a-z0-9\/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function headerRoleOf(header: string): HeaderRole {
	const folded = normHeader(header);
	if(!folded)
		return 'none';
	for(const role in HEADER_ALIASES) {
		for(const alias of HEADER_ALIASES[role]) {
			const needle = normHeader(alias);
			if(!needle)
				continue;
			if(folded == needle || folded.indexOf(needle) > -1)
				return role as HeaderRole;
		}
	}
	return 'none';
}

const NOISE_ROW = [
	'saldo do dia',
	'saldo anterior',
	'saldo final',
	'saldo atual',
	'saldo em',
	'total do periodo',
	'total do dia',
	'saldo bloqueado',
	'extrato bancario',
	'conta corrente',
	'periodo de',
	'agencia'
];

// "INFORMAÇÕES COMPLEMENTARES"-style cells pack several newline-separated
// fields into one - "FAV.: <name>\nTransferência Pix\n<pagador>\n<doc>" -
// so using the whole cell as a name glues all of that together. Pull out
// just the labeled line instead of falling back to the raw blob.
const NAME_LINE_PATTERNS = [
	/^fav(?:orecido)?\.?\s*:?\s*(.+)$/i,
	/^benefici[aá]rio\.?\s*:?\s*(.+)$/i,
	/^destinat[aá]rio\.?\s*:?\s*(.+)$/i,
	// "REM.: <name>" - the sender, on an incoming transfer's complementary info.
	/^rem(?:etente)?\.?\s*:?\s*(.+)$/i,
];

// Lines that are purely the transaction type, not a name - a cell that
// leads with one of these and nothing else on that line.
const TYPE_ONLY_LINES = [
	'recebimento pix', 'pagamento pix', 'transferencia pix',
	'pix recebido', 'pix enviado', 'credito pix', 'debito pix'
];

export function extractLabeledName(text: string): string|null {
	const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);

	for(const line of lines) {
		for(const re of NAME_LINE_PATTERNS) {
			const m = line.match(re);
			if(m && m[1].trim())
				return m[1].trim();
		}
	}

	// No "Fav.:"/"Rem.:" label - a lot of PIX cells just lead with a bare type
	// line ("Recebimento Pix") followed by the actual name, then a (masked)
	// CPF/CNPJ line and sometimes a mangled alias key. Skip the type line and
	// anything that's mostly digits (a real name always has some letters -
	// a CPF/CNPJ, masked or not, has none) and take the first line left.
	if(lines.length > 1) {
		for(const line of lines) {
			if(TYPE_ONLY_LINES.indexOf(foldPt(line)) > -1)
				continue;
			if(letterCount(line) < 3)
				continue;
			return line;
		}
	}

	return null;
}

export function isNoiseText(text: string): boolean {
	const folded = foldPt(text);
	if(!folded)
		return false;
	if(folded.indexOf('saldo') == 0)
		return true;
	for(const n of NOISE_ROW) {
		if(folded.indexOf(n) > -1)
			return true;
	}
	return false;
}

const PIX_KEYS = ['pix', 'pix recebido', 'pix_cred', 'credito pix', 'cred pix', 'debito pix', 'pagamento pix', 'transf.recebida', 'transf recebida'];
const CARD_KEYS = ['cr compras', 'recebivel de cartao', 'cartao', 'card', 'visa', 'master', 'maestro', 'elo', 'amex'];
const TED_KEYS = ['ted', 'cred.ted', 'debito ted', 'doc', 'transferencia', 'rendiment'];
const BOLETO_KEYS = ['boleto', 'deb.tit', 'deb.tít', 'pagamento de boleto', 'pagto boleto'];
const TRANSFER_KEYS = ['ted', 'transf', 'debito ted', 'debito doc', 'transacao', 'doc/ted'];
const AUTO_DEBIT_KEYS = ['conv.', 'convenio', 'debito pacote', 'deb.parcelas', 'cesta de relacionamento', 'tarifa'];
const CHEQUE_KEYS = ['cheque'];
const TYPE_PUNCH = ['pix', 'ted', 'doc', 'boleto', 'visa', 'master', 'elo', 'amex'];

export function hasTypeKeyword(text: string): boolean {
	const folded = foldPt(text);
	for(const k of TYPE_PUNCH) {
		if(folded.indexOf(k) > -1)
			return true;
	}
	return false;
}

function containsAny(folded: string, keys: string[]): boolean {
	for(const k of keys) {
		if(folded.indexOf(foldPt(k)) > -1)
			return true;
	}
	return false;
}

export function inferIncomeType(text: string): IncomeType {
	const folded = foldPt(text);
	if(containsAny(folded, PIX_KEYS))
		return 'pix';
	if(containsAny(folded, CARD_KEYS))
		return 'cartao';
	if(containsAny(folded, TED_KEYS))
		return 'deposito';
	if(containsAny(folded, CHEQUE_KEYS))
		return 'cheque';
	return 'outros';
}

export function inferPaymentType(text: string): PAYMENT_TYPES {
	const folded = foldPt(text);
	if(containsAny(folded, PIX_KEYS))
		return 'pix';
	if(containsAny(folded, BOLETO_KEYS))
		return 'boleto';
	if(containsAny(folded, AUTO_DEBIT_KEYS))
		return 'auto_debit';
	if(containsAny(folded, TRANSFER_KEYS))
		return 'transfer';
	if(containsAny(folded, CHEQUE_KEYS))
		return 'check';
	return 'other';
}

const CARD_BRANDS: {[needle: string]: string} = {
	'visa electron': 'visa débito',
	'maestro': 'mastercard débito',
	'deb outras bandeiras': 'outros débito',
	'cre outras bandeiras': 'outros',
	'mastercard': 'mastercard',
	'mast': 'mastercard',
	'visa': 'visa',
	'elo': 'elo',
	'amex': 'amex'
};

export function cardAdditionalInfo(text: string): string|undefined {
	const folded = foldPt(text);
	for(const needle in CARD_BRANDS) {
		if(folded.indexOf(needle) > -1)
			return ' ((' + CARD_BRANDS[needle] + '))';
	}
	return undefined;
}

export function isExcelSerial(n: number): boolean {
	return Number.isFinite(n) && n >= 20000 && n <= 80000 && Math.abs(n - Math.round(n)) < 1.0001;
}

export function excelSerialToISO(n: number): string {
	const epoch = new Date(1899, 11, 30);
	const days = Math.floor(n);
	epoch.setDate(epoch.getDate() + days);
	const y = epoch.getFullYear();
	const m = String(epoch.getMonth() + 1).padStart(2, '0');
	const d = String(epoch.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function parseDate(cell: any): string|null {
	if(cell == null || cell === '')
		return null;

	if(cell instanceof Date && !Number.isNaN(cell.getTime())) {
		const y = cell.getFullYear();
		const m = String(cell.getMonth() + 1).padStart(2, '0');
		const d = String(cell.getDate()).padStart(2, '0');
		if(y < 1990 || y > 2100)
			return null;
		return `${y}-${m}-${d}`;
	}

	if(typeof cell == 'number' && isExcelSerial(cell))
		return excelSerialToISO(cell);

	const raw = cellStr(cell);
	if(!raw)
		return null;

	const ofx = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?(?:\[.*)?$/);
	if(ofx && validYmd(ofx[1], ofx[2], ofx[3]))
		return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;

	const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t].*)?$/i);
	if(iso && validYmd(iso[1], iso[2], iso[3]))
		return `${iso[1]}-${iso[2]}-${iso[3]}`;

	const pt = raw.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?/);
	if(pt && validYmd(pt[3], pt[2], pt[1]))
		return `${pt[3]}-${pt[2]}-${pt[1]}`;

	return null;
}

function validYmd(y: string, m: string, d: string): boolean {
	const year = Number(y);
	const month = Number(m);
	const day = Number(d);
	return year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function parseMoney(cell: any, opts?: {allowSerial?: boolean}): MoneyParse|null {
	if(cell == null || cell === '')
		return null;

	if(typeof cell == 'number') {
		if(!Number.isFinite(cell))
			return null;
		if(isExcelSerial(cell) && !opts?.allowSerial)
			return null;
		if(Math.abs(cell) >= 1e10)
			return null;
		const signed = Number(cell.toFixed(2));
		return { amount: Math.abs(signed), signed, debitHint: signed < 0 ? true : signed > 0 ? false : null };
	}

	if(cell instanceof Date)
		return null;

	let raw = cellStr(cell);
	if(!raw)
		return null;

	raw = raw.replace(/\u00a0/g, ' ').replace(/r\$/ig, '').trim();
	if(!raw || /[\/]/.test(raw))
		return null;

	let debitHint: boolean|null = null;
	if(/^\+/.test(raw) || /\+$/.test(raw))
		debitHint = false;
	if(/^[−–—-]/.test(raw) || /[−–—-]$/.test(raw))
		debitHint = true;

	const dc = raw.match(/(?:^|[\s])([cCdD])(?:[\s]|$)/) || raw.match(/([cCdD])$/);
	if(dc) {
		const letter = dc[1].toUpperCase();
		if(letter == 'D')
			debitHint = true;
		if(letter == 'C')
			debitHint = false;
		raw = raw.replace(/[cCdD]/g, ' ');
	}

	raw = raw.replace(/[+\-−–—]/g, ' ').replace(/\s+/g, '');
	if(!raw)
		return null;

	let normalized: string;
	const lastComma = raw.lastIndexOf(',');
	const lastDot = raw.lastIndexOf('.');
	if(lastComma >= 0 && lastDot >= 0) {
		if(lastComma > lastDot)
			normalized = raw.replace(/\./g, '').replace(',', '.');
		else
			normalized = raw.replace(/,/g, '');
	} else if(lastComma >= 0) {
		const decimals = raw.length - lastComma - 1;
		if(decimals <= 2)
			normalized = raw.replace(/\./g, '').replace(',', '.');
		else
			normalized = raw.replace(/,/g, '');
	} else if(lastDot >= 0) {
		const decimals = raw.length - lastDot - 1;
		if(decimals <= 2)
			normalized = raw.replace(/,/g, '');
		else
			normalized = raw.replace(/\./g, '');
	} else {
		if(!/^\d+$/.test(raw) || raw.length > 8)
			return null;
		normalized = raw;
	}

	if(!/^\d+(\.\d{1,2})?$/.test(normalized))
		return null;

	const amount = Number(Number(normalized).toFixed(2));
	if(!Number.isFinite(amount) || amount >= 1e10)
		return null;

	const signed = debitHint === true ? -amount : amount;
	return { amount, signed, debitHint };
}

export function looksLikeDate(cell: any): boolean {
	return parseDate(cell) != null;
}

export function looksLikeMoney(cell: any): boolean {
	return parseMoney(cell) != null;
}

export function moveDirection(cell: any): 'in'|'out'|null {
	const folded = foldPt(cellStr(cell));
	if(!folded)
		return null;
	if(folded.indexOf('credit') > -1 || folded == 'c' || folded.indexOf('entrada') > -1)
		return 'in';
	if(folded.indexOf('debit') > -1 || folded == 'd' || folded.indexOf('saida') > -1)
		return 'out';
	return null;
}

export function ofxTag(block: string, tag: string): string|null {
	const re = new RegExp('<' + tag + '>([^<\\n\\r]+)', 'i');
	const m = block.match(re);
	return m ? m[1].trim() : null;
}

export function isOfxPayload(data: any[]): boolean {
	if(!data || data.length == 0)
		return false;
	if(typeof data[0] == 'string' && /<STMTTRN>/i.test(data[0]))
		return true;
	return false;
}
