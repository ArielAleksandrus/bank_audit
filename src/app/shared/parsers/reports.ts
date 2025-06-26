import { Utils } from '../helpers/utils';
import { Filters } from '../helpers/filters';

import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income, IncomeSummary } from '../models/income';
import { Tag } from '../models/tag';

export type TagClassification = {classification: {tagName: string, value: number}[], total: number};
export class Reports {

	constructor() {

	}

	boletoTagChart(boletos: Boleto[]): TagClassification {
		return this._tagChart(boletos, 'auxTags', 'value');
	}
	purchaseTagChart(purchases: Purchase[]): TagClassification {
		return this._tagChart(purchases, 'tags', 'total');
	}
	incomeSummary(incomes: Income[]): IncomeSummary {
		return Income.calculateIncomeSummary(incomes);
	}

	private _tagChart(objs: any[], tagsAttr: string = 'tags', valueAttr: string = 'value'): TagClassification {
		let res: TagClassification = {classification: [], total: 0};

		if(!objs || objs.length == 0)
			return res;

		let aux: any = {};

		for(let obj of objs) {
			let value = Number(obj[valueAttr]);
			let tags = obj[tagsAttr];
			if(!tags || tags.length == 0) {
				aux["Não classificado"] = (aux["Não classificado"] || 0) + value;
			} else {
				for(let tag of tags) {
					aux[tag.name] = (aux[tag.name] || 0) + value;
				}
			}
			res.total += Number(value.toFixed(2));
		}

		for(let tagName in aux) {
			res.classification.push({tagName: tagName, value: Number(aux[tagName].toFixed(2))});
		}
		res.classification = Filters.orderAlphabetically(res.classification, 'value', true).reverse();

		return res;
	}
}