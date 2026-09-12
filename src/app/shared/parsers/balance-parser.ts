import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income, IncomeSummary } from '../models/income';
import { Tag } from '../models/tag';

/**
 * When parsed incomes are of type 'card' (recebiveis de cartao), the card company (in the CardCompany format) must be
 * included in 'origin' field of Income, surrounded by (()), just like: "DEB CARTOES MAESTRO ((mastercard débito))"
 */
export abstract class BalanceParser {
	boletos: Boleto[] = [];
	purchases: Purchase[] = [];
	incomes: Income[] = [];
	tags: Tag[] = [];

	acceptedFormats: string = ".xls,.xlsx";
	allowsComprovantes: boolean = true;
	excelAsGrid: boolean = false;

	incomeSummary: IncomeSummary = Income.defaultIncomeSummary();

	extractTags(): void {
		this.tags = [];
		for(let obj of this.purchases) {
			for(let tag of (obj.tags || obj.aux_tags || [])) {
				Utils.pushIfNotExists(this.tags, tag, 'name');
			}
		}
		for(let obj of this.boletos) {
			for(let tag of (obj.auxTags || [])) {
				Utils.pushIfNotExists(this.tags, tag, 'name');
			}
		}
	}

	applyResult(data: {incomes?: any[], purchases?: any[], boletos?: any[]}): void {
		this.incomes = Income.fromJsonArray(data.incomes || []);
		this.purchases = Purchase.fromJsonArray(data.purchases || []);
		this.boletos = Boleto.fromJsonArray(data.boletos || []);
		this.recalculateIncome();
	}

	parseExtrato(dataArr: any[], dataType: string): void {
		throw new Error("BalanceParser->parseExtrato(): Unimplemented function");
	}

	parseComprovantes(text: string): any {
		const entries = this.extractComprovanteEntries(text);

		// Boletos need this at least as often as purchases do - a paid título
		// often shows up in the extrato as just "DÉB.TIT.COMPE EFETIVADO" with
		// no beneficiário name, and the comprovante the user pastes is
		// literally a "COMPROVANTE DE PAGAMENTO DE BOLETO".
		for(const boleto of this.boletos) {
			if(!this.isGenericSupplier(boleto.supplier_name))
				continue;

			// Primary match: the comprovante's "Número do agendamento" IS the
			// OFX's REFNUM, which our parser surfaces as bank_identification -
			// an exact id match, far more reliable than date+value (same-day
			// boletos can share a value; "Realizado" can be a day off from
			// what got posted).
			let hit = boleto.bank_identification
				? entries.find(entry => entry.documento && entry.documento == boleto.bank_identification)
				: undefined;

			// Fallback for comprovante formats with no recognizable document id.
			if(!hit) {
				const date = String(boleto.payment_date || "").slice(0, 10);
				const amount = Number(Number(boleto.value).toFixed(2));
				hit = entries.find(entry => entry.date == date && entry.value == amount);
			}

			if(hit) {
				boleto.supplier_name = hit.name;
				if(hit.cnpj)
					boleto.supplier_cnpj = hit.cnpj;
			}
		}

		// Purchases (PIX/transfer-style receipts) don't carry a document id
		// that also shows up in the extrato, so date+value is the only option.
		for(const purchase of this.purchases) {
			if(!this.isGenericSupplier(purchase.supplier_name))
				continue;
			const date = String(purchase.purchase_date || "").slice(0, 10);
			const amount = Number(Number(purchase.total).toFixed(2));
			const hit = entries.find(entry => entry.date == date && entry.value == amount);
			if(hit) {
				purchase.supplier_name = hit.name;
				if(hit.cnpj)
					purchase.supplier_cnpj = hit.cnpj;
			}
		}

		return entries;
	}

	isGenericSupplier(name: string | undefined): boolean {
		const n = (name || "").trim().toLowerCase();
		if(!n || n.length < 3)
			return true;
		if(/^\d+$/.test(n))
			return true;
		if(/^\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(n))
			return true;
		if(/n[aã]o identificado|fornecedor n[aã]o/.test(n))
			return true;
		if(/d[eé]b\.?\s*tit\.?\s*compe/.test(n))
			return true;
		if(/^(boletos?|pagto|pagamento|t[ií]tulos?|pix enviado|pix|ted|doc|transfer[eê]ncias?)$/.test(n))
			return true;
		// "Pagamento Pix ***.800.451-**" etc. - a masked CPF/CNPJ isn't a name,
		// whatever generic operation label it's glued to.
		if(/^(pagamento|recebimento)\s+pix\b/.test(n))
			return true;
		if(/\*{2,}/.test(n))
			return true;
		// "DÉB. PAGAMENTO DE BOLETO INTERCREDIS" etc. - a payment-rail/clearing
		// house name the AI copied as-is, not a supplier. "compe"/"intercredis"
		// (and similar aggregators) are settlement systems, never a favorecido.
		if(/^d[eé]b\.?\s*pagamento\s+de\s+boletos?\b/.test(n))
			return true;
		return false;
	}

	extractComprovanteEntries(text: string): {documento?: string, date: string, value: number, name: string, cnpj?: string}[] {
		const entries: {documento?: string, date: string, value: number, name: string, cnpj?: string}[] = [];

		// "Número do agendamento" is a precise, appears-exactly-once-per-record
		// boundary present in every Sicoob comprovante layout we've seen
		// (boleto, transferência, DARF, convênio alike) - splitting there
		// avoids the failure mode of splitting on "COMPROVANTE"/blank lines:
		// with that split, everything from one receipt's boundary marker up
		// to the next occurrence of "COMPROVANTE" ends up in the SAME chunk,
		// so a chunk can contain a whole extra receipt's worth of leaked text
		// (including its own date/value/name) ahead of the part that
		// actually belongs to it.
		const byAgendamento = (text || "").split(/n[uú]mero do agendamento/i);
		const usingAgendamento = byAgendamento.length > 1;
		const chunks = usingAgendamento ? byAgendamento.slice(1) : (text || "").split(/\n{2,}|COMPROVANTE/i);

		for(const chunk of chunks) {
			const documento = usingAgendamento ? (chunk.match(/^\s*(\S+)/) || [])[1] : undefined;
			const date = this._extractComprovanteDate(chunk);
			const value = this._extractComprovanteValue(chunk);
			const nameMatch = this.extractComprovanteName(chunk);
			if(!date || value == null || !nameMatch)
				continue;
			const cnpjMatch = chunk.match(/CPF\/CNPJ\s+([\d./-]+)/i);
			entries.push({
				documento,
				date,
				value,
				name: nameMatch[1].trim(),
				cnpj: cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : undefined
			});
		}
		return entries;
	}

	private _extractComprovanteDate(chunk: string): string | null {
		// Priority mirrors which date label each comprovante layout actually
		// uses for when money moved (not when it was merely scheduled):
		// "Realizado" (boleto), "Data do lançamento" (transferência), "Data de
		// pagamento" (DARF), "Data do pagamento" (convênio).
		const m = chunk.match(/Realizado\s+(\d{2}\/\d{2}\/\d{4})/i)
			|| chunk.match(/Data do lan[cç]amento\s+(\d{2}\/\d{2}\/\d{4})/i)
			|| chunk.match(/Data d[eo] pagamento\s+(\d{2}\/\d{2}\/\d{4})/i)
			|| chunk.match(/Data do agendamento\s+(\d{2}\/\d{2}\/\d{4})/i)
			|| chunk.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
			|| chunk.match(/\b(\d{4}-\d{2}-\d{2})\b/);
		if(!m)
			return null;
		const raw = m[1];
		if(!raw.includes("/"))
			return raw;
		const [d, mo, y] = raw.split("/");
		return `${y}-${mo}-${d}`;
	}

	private _extractComprovanteValue(chunk: string): number | null {
		// A boleto comprovante lists both "Documento" (face value) and "Pago"
		// (what was actually debited, after desconto/juros) - the extrato
		// only ever shows the latter, so it has to win when the two differ.
		// Other layouts (transferência, DARF, convênio) don't have "Pago" at
		// all and fall through to their own "Valor"/"Valor total" label,
		// then to the first bare R$.
		const m = chunk.match(/\bPago\s*R\$\s*([\d.]+,\d{2})/i)
			|| chunk.match(/\bValor\s+total\s*R\$\s*([\d.]+,\d{2})/i)
			|| chunk.match(/\bValor\s*R\$\s*([\d.]+,\d{2})/i)
			|| chunk.match(/R\$\s*([\d.]+,\d{2})/)
			|| chunk.match(/\b(\d+,\d{2})\b/);
		return m ? Number.parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null;
	}

	// A boleto comprovante's "Beneficiário" field is laid out as its own
	// line - "Nome/Razão Social<tabs>VALUE" - not "label: value", so a
	// naive "label separator value" regex ends up capturing the label text
	// itself as part of the name. Scope the search to a section and pull
	// the value off that specific line instead. Priority order mirrors the
	// old per-bank comprovante parsers: "Beneficiário final" (the ultimate
	// recipient, when a payment passed through an intermediary) beats plain
	// "Beneficiário", which beats a same-titularidade transfer's "Crédito"
	// account holder, which beats a generic favorecido/destinatário label.
	// Never Pagador's Nome/Razão social - that's just the company itself.
	private extractComprovanteName(chunk: string): RegExpMatchArray | null {
		const final = chunk.match(/benefici[aá]rio\s+final[\s\S]{0,400}/i);
		if(final) {
			const nameLine = final[0].match(/nome(?:\/raz[aã]o\s*social)?\s*[ \t]+([^\n]+)/i);
			if(nameLine)
				return nameLine;
		}
		const section = chunk.match(/benefici[aá]rio(?!\s*final)[\s\S]{0,400}/i);
		if(section) {
			const nameLine = section[0].match(/nome(?:\/raz[aã]o\s*social)?\s*[ \t]+([^\n]+)/i);
			if(nameLine)
				return nameLine;
		}
		// "Comprovante de transferência entre contas correntes": the
		// recipient's account is listed under a "Crédito" section as
		// "Conta    <number> / <name>" - no Beneficiário field at all.
		const credito = chunk.match(/\bcr[eé]dito\b[\s\S]{0,300}/i);
		if(credito) {
			const contaLine = credito[0].match(/conta\s+[^\n\/]*\/\s*([^\n]+)/i);
			if(contaLine)
				return contaLine;
		}
		return chunk.match(/(?:favorecido|destinat[aá]rio)\s*[:\n]\s*([^\n]+)/i);
	}

	recalculateIncome(): IncomeSummary {
		let sum: IncomeSummary = Income.calculateIncomeSummary(this.incomes);
		this.incomeSummary = sum;
		return sum;
	}

}
