import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';
import { Tag } from '../models/tag';

export abstract class BalanceParser {
	boletos: Boleto[] = [];
	purchases: Purchase[] = [];
	incomes: Income[] = [];
	tags: Tag[] = [];

	acceptedFormats: string = ".xls,.xlsx";
	allowsComprovantes: boolean = true;

	sumReceita = {
		cred: {
			visa: 0,
			master: 0,
			elo: 0,
			outros: 0,
			total: 0
		},
		deb: {
			visa: 0,
			master: 0,
			elo: 0,
			outros: 0,
			total: 0
		},
		outros_cartoes: {
			total: 0
		},
		total_cartoes: 0,
		pix: 0,
		total: 0
	};

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
	recalculateIncome(): void {
		throw new Error("BalanceParser->recalculateIncome(): Unimplemented function");
	}
}