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
		return false;
	}

	extractComprovanteEntries(text: string): {date: string, value: number, name: string, cnpj?: string}[] {
		const entries: {date: string, value: number, name: string, cnpj?: string}[] = [];
		const chunks = (text || "").split(/\n{2,}|COMPROVANTE/i);
		for(const chunk of chunks) {
			const dateMatch = chunk.match(/\b(\d{2}\/\d{2}\/\d{4})\b/) || chunk.match(/\b(\d{4}-\d{2}-\d{2})\b/);
			const valMatch = chunk.match(/R\$\s*([\d.]+,\d{2})/) || chunk.match(/\b(\d+,\d{2})\b/);
			const nameMatch = chunk.match(/(?:favorecido|benefici[aá]rio|destinat[aá]rio|nome(?:\/raz[aã]o social)?)\s*[:\n]\s*([^\n]+)/i);
			if(!dateMatch || !valMatch || !nameMatch)
				continue;
			let date = dateMatch[1];
			if(date.includes("/")) {
				const [d, m, y] = date.split("/");
				date = `${y}-${m}-${d}`;
			}
			const value = Number.parseFloat(valMatch[1].replace(/\./g, "").replace(",", "."));
			entries.push({ date, value, name: nameMatch[1].trim() });
		}
		return entries;
	}
	recalculateIncome(): IncomeSummary {
		let sum: IncomeSummary = Income.calculateIncomeSummary(this.incomes);
		this.incomeSummary = sum;
		return sum;
	}

}