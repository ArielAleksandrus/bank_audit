import { BalanceParser } from './balance-parser';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';
import {
	MIN_DESC_LETTERS,
	cardAdditionalInfo,
	cellStr,
	foldPt,
	hasTypeKeyword,
	headerRoleOf,
	inferIncomeType,
	inferPaymentType,
	isNoiseText,
	isOfxPayload,
	letterCount,
	looksLikeDate,
	looksLikeMoney,
	moveDirection,
	ofxTag,
	parseDate,
	parseMoney,
	HeaderRole
} from './omni-conventions';

type ColRoles = {
	date: number;
	value: number;
	debit: number;
	credit: number;
	desc: number;
	origin: number;
	dest: number;
	doc: number;
	move: number;
	extraName: number;
	saldo: number;
};

const EMPTY_ROLES: ColRoles = {
	date: -1, value: -1, debit: -1, credit: -1, desc: -1,
	origin: -1, dest: -1, doc: -1, move: -1, extraName: -1, saldo: -1
};

/**
 * Format-agnostic parser for Excel and OFX extratos.
 * Bank-specific parsers remain the source of the conventions used here.
 */
export class OmniParser extends BalanceParser {
	override acceptedFormats = '.xls,.xlsx,.ofx';
	override allowsComprovantes = false;
	override excelAsGrid = true;

	bankName: string;

	constructor(bankName: string = 'outro') {
		super();
		this.bankName = bankName;
	}

	override parseExtrato(dataArr: any[], dataType: string): void {
		this.boletos = [];
		this.purchases = [];
		this.incomes = [];

		const kind = dataType || (isOfxPayload(dataArr) ? 'ofx' : 'excel');
		if(kind == 'ofx')
			this.parseOFX(dataArr);
		else
			this.parseExcel(dataArr);

		this.recalculateIncome();
	}

	parseExcel(dataArr: any[]): void {
		const grid = this.toGrid(dataArr);
		if(grid.length == 0)
			return;

		const headerRow = this.findHeaderRow(grid);
		const roles = this.resolveColumns(grid, headerRow);
		const start = headerRow >= 0 ? headerRow + 1 : 0;

		for(let i = start; i < grid.length; i++)
			this.consumeRow(grid[i], roles);
	}

	parseOFX(dataArr: any[]): void {
		const text = typeof dataArr[0] == 'string' ? dataArr[0] : '';
		if(!text)
			return;

		const parts = text.split(/<STMTTRN>/i);
		for(let i = 1; i < parts.length; i++)
			this.consumeOfxEntry(parts[i]);
	}

	private consumeOfxEntry(raw: string): void {
		const amountStr = ofxTag(raw, 'TRNAMT');
		const money = parseMoney(amountStr);
		const date = parseDate(ofxTag(raw, 'DTPOSTED'));
		const memo = ofxTag(raw, 'MEMO') || ofxTag(raw, 'NAME') || '';
		const trntype = ofxTag(raw, 'TRNTYPE');
		const doc = ofxTag(raw, 'REFNUM') || ofxTag(raw, 'FITID') || '';

		if(!date || !money)
			return;

		let dir = moveDirection(trntype);
		if(!dir)
			dir = money.signed < 0 || money.debitHint === true ? 'out' : 'in';

		const name = this.pickName(memo, '', dir);
		this.emit(date, money.amount, dir, name, memo, doc);
	}

	private consumeRow(row: any[], roles: ColRoles): void {
		const date = this.dateFromRow(row, roles);
		const money = this.moneyFromRow(row, roles);
		if(!date || !money)
			return;

		const narrative = this.textFrom(row, roles.desc);
		const extra = this.textFrom(row, roles.extraName);
		const origin = this.textFrom(row, roles.origin);
		const dest = this.textFrom(row, roles.dest);
		const blob = [narrative, extra, origin, dest].filter(Boolean).join(' ');

		if(isNoiseText(narrative) || isNoiseText(blob))
			return;
		if(!this.hasDescription(narrative, extra, origin, dest, blob))
			return;

		const dir = this.directionFromRow(row, roles, money, blob);
		if(!dir)
			return;

		const name = this.pickName(
			dir == 'in' ? (origin || extra || narrative) : (dest || extra || narrative),
			narrative,
			dir
		);
		this.emit(date, money.amount, dir, name, blob, this.textFrom(row, roles.doc));
	}

	private emit(date: string, amount: number, dir: 'in'|'out', name: string, blob: string, doc: string): void {
		const value = Number(amount.toFixed(2));
		if(value <= 0)
			return;

		if(dir == 'in') {
			const incomeType = inferIncomeType(blob);
			this.incomes.push(new Income({
				id: this.newId(),
				company_id: 0,
				date_received: date,
				origin: name,
				bank_name: this.bankName,
				bank_identification: doc || undefined,
				income_type: incomeType,
				additional_info: incomeType == 'cartao' ? cardAdditionalInfo(blob) : undefined,
				value: value
			}));
			return;
		}

		const paymentType = inferPaymentType(blob);
		const purchase = new Purchase({
			id: this.newId(),
			company_id: 0,
			supplier_id: 0,
			supplier_name: name,
			purchase_date: date,
			payment_type: paymentType,
			bank_name: this.bankName,
			base_value: value,
			delivery_fee: 0,
			total: value
		});

		if(paymentType == 'boleto') {
			const boleto = new Boleto({
				id: this.newId(),
				purchase_id: 0,
				bank_name: this.bankName,
				bank_identification: doc || undefined,
				value: value,
				payment_date: date,
				supplier_name: name
			});
			boleto.auxTags = [];
			purchase.boletos = [boleto];
			this.boletos.push(boleto);
		} else {
			this.purchases.push(purchase);
		}
	}

	private pickName(preferred: string, fallback: string, _dir: 'in'|'out'): string {
		const a = (preferred || '').trim();
		if(a && !isNoiseText(a))
			return a;
		const b = (fallback || '').trim();
		if(b && !isNoiseText(b))
			return b;
		return 'DESCONHECIDO';
	}

	private hasDescription(...parts: string[]): boolean {
		const joined = parts.filter(Boolean).join(' ');
		if(hasTypeKeyword(joined))
			return true;
		return letterCount(joined) >= MIN_DESC_LETTERS;
	}

	private dateFromRow(row: any[], roles: ColRoles): string|null {
		if(roles.date >= 0) {
			const d = parseDate(row[roles.date]);
			if(d)
				return d;
		}
		for(let i = 0; i < row.length; i++) {
			if(i == roles.value || i == roles.saldo || i == roles.debit || i == roles.credit)
				continue;
			const d = parseDate(row[i]);
			if(d)
				return d;
		}
		return null;
	}

	private moneyFromRow(row: any[], roles: ColRoles): {amount: number, signed: number, debitHint: boolean|null}|null {
		if(roles.debit >= 0 || roles.credit >= 0) {
			const debit = roles.debit >= 0 ? parseMoney(row[roles.debit]) : null;
			const credit = roles.credit >= 0 ? parseMoney(row[roles.credit]) : null;
			if(debit && debit.amount > 0 && (!credit || credit.amount == 0))
				return { amount: debit.amount, signed: -debit.amount, debitHint: true };
			if(credit && credit.amount > 0 && (!debit || debit.amount == 0))
				return { amount: credit.amount, signed: credit.amount, debitHint: false };
		}
		if(roles.value >= 0) {
			const parsed = parseMoney(row[roles.value], {allowSerial: true});
			if(parsed)
				return parsed;
		}
		let found: {amount: number, signed: number, debitHint: boolean|null}|null = null;
		for(let i = 0; i < row.length; i++) {
			if(i == roles.date || i == roles.saldo || i == roles.doc)
				continue;
			const parsed = parseMoney(row[i]);
			if(!parsed)
				continue;
			if(found)
				return found;
			found = parsed;
		}
		return found;
	}

	private directionFromRow(
		row: any[],
		roles: ColRoles,
		money: {amount: number, signed: number, debitHint: boolean|null},
		blob: string
	): 'in'|'out'|null {
		if(roles.move >= 0) {
			const dir = moveDirection(row[roles.move]);
			if(dir)
				return dir;
		}
		if(money.debitHint === true)
			return 'out';
		if(money.debitHint === false)
			return 'in';
		if(money.signed < 0)
			return 'out';
		if(money.signed > 0)
			return 'in';

		const folded = foldPt(blob);
		if(folded.indexOf('deb') == 0 || folded.indexOf('pagamento') > -1 || folded.indexOf('saida') > -1)
			return 'out';
		if(folded.indexOf('cred') == 0 || folded.indexOf('receb') > -1 || folded.indexOf('entrada') > -1)
			return 'in';
		return null;
	}

	private textFrom(row: any[], idx: number): string {
		if(idx < 0)
			return '';
		return cellStr(row[idx]);
	}

	private toGrid(dataArr: any[]): any[][] {
		if(!dataArr || dataArr.length == 0)
			return [];
		if(Array.isArray(dataArr[0]))
			return (dataArr as any[][]).map(row => Array.isArray(row) ? row : [row]);

		const keys: string[] = [];
		for(const row of dataArr) {
			if(!row || typeof row != 'object')
				continue;
			for(const key of Object.keys(row)) {
				if(key == '__rowNum__')
					continue;
				if(keys.indexOf(key) < 0)
					keys.push(key);
			}
		}
		if(keys.length == 0)
			return [];
		const body = dataArr.map(row => keys.map(k => row ? row[k] : null));
		return [keys, ...body];
	}

	private findHeaderRow(grid: any[][]): number {
		const limit = Math.min(grid.length, 20);
		let best = -1;
		let bestHits = 1;
		for(let i = 0; i < limit; i++) {
			let hits = 0;
			for(const cell of grid[i]) {
				if(headerRoleOf(cellStr(cell)) != 'none')
					hits++;
			}
			if(hits > bestHits) {
				bestHits = hits;
				best = i;
			}
		}
		return best;
	}

	private resolveColumns(grid: any[][], headerRow: number): ColRoles {
		const colCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
		const roles: ColRoles = { ...EMPTY_ROLES };
		const start = headerRow >= 0 ? headerRow + 1 : 0;
		const headers = headerRow >= 0 ? grid[headerRow].map(cellStr) : [];

		const headerRoles: HeaderRole[] = [];
		for(let c = 0; c < colCount; c++)
			headerRoles[c] = headerRow >= 0 ? headerRoleOf(headers[c] || '') : 'none';

		for(let c = 0; c < colCount; c++) {
			const role = headerRoles[c];
			if(role == 'none')
				continue;
			if(roles[role as keyof ColRoles] < 0 && role != 'saldo')
				(roles as any)[role] = c;
			if(role == 'saldo')
				roles.saldo = c;
		}

		const scores = this.scoreColumns(grid, start, colCount, headerRoles);
		if(roles.date < 0)
			roles.date = this.bestScore(scores, 'date', 2);
		if(roles.value < 0)
			roles.value = this.pickValueColumn(scores, roles, headerRoles);
		if(roles.desc < 0)
			roles.desc = this.bestScore(scores, 'text', 2, [roles.date, roles.value, roles.saldo, roles.debit, roles.credit]);

		if(roles.saldo < 0 && roles.value >= 0)
			roles.saldo = this.detectSaldo(scores, roles.value);

		return roles;
	}

	private scoreColumns(grid: any[][], start: number, colCount: number, headerRoles: HeaderRole[]) {
		const scores = [];
		for(let c = 0; c < colCount; c++) {
			let dateHits = 0, moneyHits = 0, textHits = 0, filled = 0, signChanges = 0;
			let lastSign: number|null = null;
			const moneySeries: (number|null)[] = [];
			for(let r = start; r < grid.length; r++) {
				const cell = grid[r][c];
				if(cell == null || cell === '') {
					moneySeries.push(null);
					continue;
				}
				filled++;
				const asDate = looksLikeDate(cell);
				const asMoney = looksLikeMoney(cell);
				if(asDate)
					dateHits++;
				if(asMoney && !asDate) {
					moneyHits++;
					const parsed = parseMoney(cell);
					const signed = parsed ? parsed.signed : 0;
					moneySeries.push(signed);
					const sign = signed == 0 ? 0 : (signed < 0 ? -1 : 1);
					if(lastSign != null && sign != 0 && sign != lastSign)
						signChanges++;
					if(sign != 0)
						lastSign = sign;
				} else {
					moneySeries.push(null);
					if(letterCount(cellStr(cell)) >= MIN_DESC_LETTERS || hasTypeKeyword(cellStr(cell)))
						textHits++;
				}
			}
			scores.push({ dateHits, moneyHits, textHits, filled, signChanges, moneySeries, header: headerRoles[c] });
		}
		return scores;
	}

	private bestScore(
		scores: {dateHits: number, moneyHits: number, textHits: number}[],
		kind: 'date'|'money'|'text',
		minHits: number,
		exclude: number[] = []
	): number {
		let best = -1;
		let bestVal = minHits - 1;
		for(let c = 0; c < scores.length; c++) {
			if(exclude.indexOf(c) >= 0)
				continue;
			const val = kind == 'date' ? scores[c].dateHits : kind == 'money' ? scores[c].moneyHits : scores[c].textHits;
			if(val > bestVal) {
				bestVal = val;
				best = c;
			}
		}
		return best;
	}

	private pickValueColumn(
		scores: {moneyHits: number, signChanges: number, header: HeaderRole}[],
		roles: ColRoles,
		headerRoles: HeaderRole[]
	): number {
		if(roles.debit >= 0 || roles.credit >= 0)
			return -1;

		let best = -1;
		let bestVal = -1;
		for(let c = 0; c < scores.length; c++) {
			if(c == roles.date || headerRoles[c] == 'saldo' || headerRoles[c] == 'doc')
				continue;
			const bonus = scores[c].signChanges * 2 + (headerRoles[c] == 'value' ? 50 : 0);
			const val = scores[c].moneyHits + bonus;
			if(val > bestVal && scores[c].moneyHits >= 1) {
				bestVal = val;
				best = c;
			}
		}
		return best;
	}

	private detectSaldo(
		scores: {header: HeaderRole, moneySeries: (number|null)[]}[],
		valueCol: number
	): number {
		for(let c = 0; c < scores.length; c++) {
			if(c == valueCol)
				continue;
			if(scores[c].header == 'saldo')
				return c;
		}
		return -1;
	}

	private newId(): number {
		return -Math.floor(Math.random() * 1000000);
	}
}
