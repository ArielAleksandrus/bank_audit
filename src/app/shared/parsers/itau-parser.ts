import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';

/*
 * PDF limitations.
 * So far we're able to add generic income and outcome
 * So, no cards are supported yet
 */

/*
 * PDF assumptions: income records will have 4 columns
 * first is date
 * second is description
 * third is source
 * fourth is value
 * 
 * outcome records will have 3 columns
 * first is date
 * second is description
 * third is value
 * 
 * rendimento records will have 2 columns
 * and will be preceded by ['RENDIMENTOS <...>']
 * first is date
 * second is value
 */

export class ItauParser extends BalanceParser {
	dataArr: any[] = [];

	parsedHeaders: string[] = [];
	parsedRows: any[] = [];

	override acceptedFormats: string = ".pdf";

	constructor() {
		super();
	}
	override parseExtrato(dataArr: any[], dataType: 'pdf'): void{
		this.dataArr = dataArr;
		this.parsedHeaders = [];
		this.parsedRows = [];

		switch(dataType) {
		case('pdf'): {
			this.parsePDF();
		}
		}
		
		this.recalculateIncome();
	}

	parsePDF() {
		this.parsedHeaders = [];
		this.parsedRows = [];

		if(!this.dataArr || this.dataArr.length < 2) {
			console.error("Itau: dataArr is too small");
		}
		this._parseRows(this.dataArr);
		console.log(this);
		return;
	}

	private _parseRows(dataArr: any[]) {
		let started: boolean = false;
		for(let i = 0; i < dataArr.length; i++) {
			let row = dataArr[i];
			if(row[0] && row[0] == "Data") {
				started = true;
			}
			if(!started || !row[0])
				continue;

			if(!Utils.isPtBrDate(row[0]))
				continue;

			if(row[1] && row[1].toLowerCase().indexOf("saldo") > -1)
				continue;

			if(row.length == 4 || row.length == 3) {
				let val = row[row.length - 1];
				if(Utils.isValue(val)) {
					if(Utils.valueToFloat(val) > 0){
						let inc = this._parseIncome(dataArr, i);
						if(inc) this.incomes.push(inc);
					} else {
						let purchase = this._parseOutcome(dataArr, i);
						if(purchase) this.purchases.push(purchase);
					}
				} else {
					continue;
				}
			} else if(row.length == 2) {
				let inc: Income|null = this._parseRendimento(dataArr, i);
				if(inc) this.incomes.push(inc);
			}

		}
	}
	private _parseIncome(dataArr: any[], rowIdx: number) {
		let row = dataArr[rowIdx];
		let date = Utils.datePtBrToISO(row[0]);
		let origin = row[1];
		if(!Number.isNaN(origin.replace(".","").replace("-","").replace("/",""))) { // is cnpj?
			origin = dataArr[rowIdx-1][0]; // origin is on the upper row
		}
		let value = row[row.length - 1];
		if(!Utils.isValue(value) || Utils.valueToFloat(value) < 0)
			return null;

		return new Income({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			date_received: date,
			origin: origin,
			bank_name: "itau",
			//bank_identification: no bank identification is given,
			income_type: this._getIncomeType(row[1]),
			value: Utils.valueToFloat(value)
		});
	}
	private _parseOutcome(dataArr: any[], rowIdx: number) {
		let row = dataArr[rowIdx];
		let value = row[row.length - 1];
		if(!Utils.isValue(value) || Utils.valueToFloat(value) > 0)
			return null;

		return new Purchase({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			supplier_id: 0, // server will set this for us
			supplier_name: row[1],
			purchase_date: Utils.datePtBrToISO(row[0]),
			payment_type: this._getOutcomeType(row[1]),
			bank_name: "itau",
			base_value: -Utils.valueToFloat(value), 
			delivery_fee: 0,
			total: -Utils.valueToFloat(value)
		});
	}
	private _parseRendimento(dataArr: any[], rowIdx: number): Income|null {
		let row = dataArr[rowIdx];
		if(Utils.isPtBrDate(row[0]) && Utils.isValue(row[1]) && dataArr[rowIdx - 1][0].toLowerCase().indexOf("rendiment") > -1) {
			return new Income({
				id: -Math.floor(Math.random() * 1000000),
				company_id: 0, // server will set this for us
				date_received: Utils.datePtBrToISO(row[0]),
				origin: "Rendimento ITAU",
				bank_name: "itau",
				//bank_identification: no bank identification is given,
				income_type: "deposito",
				value: Utils.valueToFloat(row[1])
			});
		}
		return null;
	}
	private _getIncomeType(str: string): 'cartao'|'pix'|'deposito'|'cheque'|'outros' {
		str = str.toLowerCase();
		if(str.indexOf("pix") > -1) return 'pix';
		else if(str.indexOf("ifood") > -1 || str.indexOf("ted ") > -1 || str.indexOf("doc ") > -1 || str.indexOf("transf") > -1) return 'deposito';
		else if(str.indexOf("master") > -1 || str.indexOf("visa") > -1 || str.indexOf("cartao") > -1 || str.indexOf("card") > -1) return 'cartao';
		return 'outros';
	}
	private _getOutcomeType(str: string): 'cash'|'boleto'|'check'|'credit_card'|'debit_card'|'pix'|'transfer'|'auto_debit'|'other' {
		str = str.toLowerCase();
		if(str.indexOf("pix") > -1) return 'pix';

		return 'other';
	}
}