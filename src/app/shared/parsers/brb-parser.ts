/**
 * Right now, BrbParser will parse ONLY
 * 1. Pix incomes
 * 2. Pix payments
 * BOLETO is NOT supported
 * other payments and incomes may not be correctly parsed
 */

import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';

export class BrbParser extends BalanceParser {
	dataArr: any[] = [];
	year: number = 1800;

	override acceptedFormats: string = ".pdf";

	constructor() {
		super();
	}
	override parseExtrato(dataArr: any[], dataType: 'pdf'): void{
		this.dataArr = dataArr;

		switch(dataType) {
		case('pdf'): {
			this.parsePDF();
		}
		}
		
		this.recalculateIncome();
	}

	// dataArr will be an array of arrays
	/*
	['CREDITO PIX', '–', 'DOC: 000000']
	['30/04', 'R$', '+109,70']
	['ISABELA XXXX OLIVE', '—', '4165'] (if no name is given, array will have less elements!)
	
	['28/04', 'CRED JUROS LIQUIDO CDB AUTOMAT', '–', 'DOC: 000000', 'R$', '+13,96']

	['DEBITO PIX', '–', 'DOC: 000000']
	['10/04', 'R$', '−', '23.557,00']
	['ARIEL XXXXX', '—', '4165']

	this translates to:

	Income: ISABELA XXXX OLIVE 109.70
	Income: CRED JUROS LIQUIDO CDB 13.96
	Purchase: ARIEL XXXXX 23557.00
	 */
	parsePDF() {
		this.boletos = [];
		this.purchases = [];
		this.incomes = [];

		if(!this.dataArr || this.dataArr.length < 2) {
			console.error("BrbParser: dataArr is too small", this.dataArr);
			return;
		}
		this._getYear();

		for(let i = 0; i < this.dataArr.length; i++) {
			let inc = this.parseCreditoPix(i);
			if(inc != null) {
				this.incomes.push(inc);
				i += 2; // we already analysed the next two rows in parseCreditoPix
				continue;
			}
			let pur = this.parseDebitoPix(i);
			if(pur != null) {
				this.purchases.push(pur);
				i += 2; // we already analysed the next two rows in parseDebitoPix
				continue;
			}

			inc = this.parseOtherIncome(i);
			if(inc != null) {
				this.incomes.push(inc);
				continue;
			}
			pur = this.parseOtherPurchase(i);
			if(pur != null) {
				this.purchases.push(pur);
				continue;
			}
		}
	}

	parseOtherIncome(rowIdx: number): Income|null {
		let row: string[] = this.dataArr[rowIdx];;
		let valueCol = row[row.length - 1]; // value col is the last col
		let value = this._getValue(valueCol);
		let date = Utils.datePtBrToISO(row[0] + `/${this.year}`);

		if(date == null || value == null || value < 0)
			return null;

		return new Income({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			date_received: date,
			origin: row[1],
			bank_name: "brb",
			//bank_identification: no bank identification is given,
			income_type: "outros",
			value: value
		});
	}
	parseOtherPurchase(rowIdx: number): Purchase|null {
		let row: string[] = this.dataArr[rowIdx];;
		let valueCol = row[row.length - 1]; // value col is the last col
		let value = this._getValue(valueCol);
		let date = Utils.datePtBrToISO(row[0] + `/${this.year}`);

		if(date == null || value == null || value >= 0)
			return null;

		return new Purchase({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			supplier_id: 0, // server will set this for us
			supplier_name: row[1],
			purchase_date: date,
			payment_type: "other",
			bank_name: "brb",
			base_value: Math.abs(value), 
			delivery_fee: 0,
			total: Math.abs(value) 
		});
	}
	parseCreditoPix(rowIdx: number): Income|null {
		let creditoPixRow: string[] = this.dataArr[rowIdx];
		let dateValueRow: string[] = this.dataArr[rowIdx + 1];
		let originRow: string[] = this.dataArr[rowIdx + 2];

		if(!creditoPixRow || !creditoPixRow[0] || !originRow || !dateValueRow || !dateValueRow[2])
			return null;

		let description: string = creditoPixRow[0].toLowerCase();
		if(description.indexOf("credito pix") == -1 && description.indexOf("cred pix") == -1)
			return null;

		let value = this._getValue(dateValueRow[2]);
		if(value == null)
			return null;

		return new Income({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			date_received: Utils.datePtBrToISO(dateValueRow[0] + `/${this.year}`),
			origin: (originRow.length > 1 ? originRow[0] : "desconhecido"),
			bank_name: "brb",
			//bank_identification: no bank identification is given,
			income_type: "pix",
			value: value
		});
	}
	parseDebitoPix(rowIdx: number): Purchase|null {
		let debitoPixRow: string[] = this.dataArr[rowIdx];
		let dateValueRow: string[] = this.dataArr[rowIdx + 1];
		let originRow: string[] = this.dataArr[rowIdx + 2];

		if(!debitoPixRow || !debitoPixRow[0] || !originRow || !dateValueRow || !dateValueRow[2])
			return null;

		let description: string = debitoPixRow[0].toLowerCase();
		if(description.toLowerCase().indexOf("debito pix") == -1)
			return null;

		let value = this._getValue(dateValueRow[2]);
		if(value == null)
			return null;

		return new Purchase({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			supplier_id: 0, // server will set this for us
			supplier_name: originRow[0],
			purchase_date: Utils.datePtBrToISO(dateValueRow[0] + `/${this.year}`),
			payment_type: "pix",
			bank_name: "sicredi",
			base_value: Math.abs(value), // 'despesa' and 'boleto' values are negative. we will fix this now. 
			delivery_fee: 0,
			total: Math.abs(value) // 'despesa' and 'boleto' values are negative. we will fix this now. 
		});
	}

	private _getValue(val: string): number|null {
		if(val[0] == "+") {
			// value is positive
		} else {
			if(val[0] != "-")
				val = "-" + val;
		}
		let res = Number(val.replace(".","").replace(",","."));
		if(Number.isNaN(res))
			return null;
		else
			return res;
	}
	private _getYear(): number {
		for(let row of this.dataArr) {
			if(!row[0])
				continue;
			if(Utils.isPtBrDate(row[0])) {
				this.year = Number(row[0].split(" ")[0].split("/")[2]);
				return this.year;
			}			
		}
		return 1800;
	}
}