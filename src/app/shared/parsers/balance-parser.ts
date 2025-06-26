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

	parseExtrato(dataArr: any[], dataType: string): void {
		throw new Error("BalanceParser->parseExtrato(): Unimplemented function");
	}
	parseComprovantes(text: string): any {
		throw new Error("BalanceParser->parseComprovantes(): Unimplemented function");
	}
	recalculateIncome(): IncomeSummary {
		let sum: IncomeSummary = Income.calculateIncomeSummary(this.incomes);
		this.incomeSummary = sum;
		return sum;
	}

}