import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';
import { Tag } from '../models/tag';

export type TagClassification = {classification: {[tagName: string]: number}, total: number};
export class Reports {

	constructor() {

	}

	boletoTagChart(boletos: Boleto[]): TagClassification {
		if(!boletos || boletos.length == 0)
			return {classification: {}, total: 0};

		let classification: any = {};
		let total = 0;

		for(let boleto of boletos) {
			let value = Number(boleto.value);
			let foundTags: string[] = [];
			if(!boleto.auxTags || boleto.auxTags.length == 0) {
				foundTags.push("Não classificado");
			} else {
				for(let tag of boleto.auxTags) {
					foundTags.push(tag.name);
				}
			}
			for(let tag of foundTags) {
				if(!classification[tag])
					classification[tag] = 0;
				classification[tag] += value;
				classification[tag] = Number(classification[tag].toFixed(2));
			}
			total += value;
			total = Number(total.toFixed(2));
		}

		return {classification: classification, total: total};
	}
	purchaseTagChart(purchases: Purchase[]): TagClassification {
		if(!purchases || purchases.length == 0)
			return {classification: {}, total: 0};

		let classification: any = {};
		let total = 0;

		for(let purchase of purchases) {
			let value = Number(purchase.total);
			let foundTags: string[] = [];
			if(!purchase.tags || purchase.tags.length == 0) {
				foundTags.push("Não classificado");
			} else {
				for(let tag of purchase.tags) {
					foundTags.push(tag.name);
				}
			}
			for(let tag of foundTags) {
				if(!classification[tag])
					classification[tag] = 0;
				classification[tag] += value;
				classification[tag] = Number(classification[tag].toFixed(2));
			}
			total += value;
			total = Number(total.toFixed(2));
		}

		return {classification: classification, total: total};
	}
}