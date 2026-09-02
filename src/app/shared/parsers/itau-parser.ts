import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';

/*
 * PDF layout varies by export. Rows are grouped by Y in ParserComponent.
 *
 * Current Itaú PJ extrato columns:
 *   Data | Lançamentos | Razão Social | CNPJ/CPF | Valor (R$) | Saldo (R$)
 * Names wrap, so a logical launch can be split across 2-3 extracted rows.
 *
 * We treat any dated row whose last numeric cell is a money value as a
 * launch. Description/supplier are taken from non-document cells, or from
 * the immediately preceding undated lines (TED/iFood wraps, rendimentos).
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

			if(this._isSaldoRow(row))
				continue;

			let inc: Income|null = this._parseRendimento(dataArr, i);
			if(inc) {
				this.incomes.push(inc);
				continue;
			}

			const val = this._valueFromRow(row);
			if(val == null)
				continue;

			if(Utils.valueToFloat(val) > 0){
				inc = this._parseIncome(dataArr, i, val);
				if(inc) this.incomes.push(inc);
			} else {
				let purchase = this._parseOutcome(dataArr, i, val);
				if(purchase) this.purchases.push(purchase);
			}
		}
	}
	private _isSaldoRow(row: any[]): boolean {
		return row.some((cell: any) => String(cell || "").toLowerCase().indexOf("saldo") > -1);
	}
	private _isMoney(str: any): boolean {
		return typeof str == "string" && Utils.isValue(str);
	}
	private _isCnpjCpf(str: any): boolean {
		if(str == null)
			return false;
		const digits = String(str).replace(/\D/g, "");
		return digits.length == 11 || digits.length == 14;
	}
	private _valueFromRow(row: any[]): string|null {
		for(let i = row.length - 1; i >= 1; i--) {
			if(this._isMoney(row[i]))
				return row[i];
		}
		return null;
	}
	private _labelCells(row: any[]): string[] {
		const labels: string[] = [];
		for(let i = 1; i < row.length; i++) {
			const cell = row[i];
			if(!cell || this._isMoney(cell) || this._isCnpjCpf(cell))
				continue;
			labels.push(String(cell).trim());
		}
		return labels;
	}
	private _contextLabels(dataArr: any[], rowIdx: number): string[] {
		const prev = dataArr[rowIdx - 1];
		if(!prev || !prev.length || Utils.isPtBrDate(prev[0]))
			return [];

		const labels: string[] = [];
		for(const cell of prev) {
			if(!cell || this._isMoney(cell) || this._isCnpjCpf(cell))
				continue;
			const text = String(cell).trim();
			if(text)
				labels.push(text);
		}
		return labels;
	}
	private _descriptionOf(dataArr: any[], rowIdx: number): string {
		const row = dataArr[rowIdx];
		const onRow = this._labelCells(row);
		if(onRow.length)
			return onRow[0];

		const around = this._contextLabels(dataArr, rowIdx);
		return around[0] || "";
	}
	private _supplierOf(dataArr: any[], rowIdx: number, fallback: string): string {
		const row = dataArr[rowIdx];
		const onRow = this._labelCells(row);
		if(onRow.length > 1)
			return onRow[1];

		const around = this._contextLabels(dataArr, rowIdx);
		for(const label of around) {
			if(label && label != fallback)
				return label;
		}
		return fallback;
	}
	private _parseIncome(dataArr: any[], rowIdx: number, value: string): Income|null {
		let row = dataArr[rowIdx];
		let date = Utils.datePtBrToISO(row[0]);
		const origin = this._descriptionOf(dataArr, rowIdx);
		if(!this._isMoney(value) || Utils.valueToFloat(value) < 0)
			return null;

		const incomeType = this._getIncomeType(origin + " " + (row[1] || ""));
		return new Income({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			date_received: date,
			origin: origin || row[1],
			bank_name: "itau",
			//bank_identification: no bank identification is given,
			income_type: incomeType,
			additional_info: this._cardAdditionalInfo(origin + " " + (row[1] || "")),
			value: Utils.valueToFloat(value)
		});
	}
	private _parseOutcome(dataArr: any[], rowIdx: number, value: string): Purchase|null {
		let row = dataArr[rowIdx];
		if(!this._isMoney(value) || Utils.valueToFloat(value) > 0)
			return null;

		const description = this._descriptionOf(dataArr, rowIdx) || row[1];
		const supplier = this._supplierOf(dataArr, rowIdx, description);
		return new Purchase({
			id: -Math.floor(Math.random() * 1000000),
			company_id: 0, // server will set this for us
			supplier_id: 0, // server will set this for us
			supplier_name: supplier,
			purchase_date: Utils.datePtBrToISO(row[0]),
			payment_type: this._getOutcomeType(description),
			bank_name: "itau",
			base_value: -Utils.valueToFloat(value), 
			delivery_fee: 0,
			total: -Utils.valueToFloat(value)
		});
	}
	private _parseRendimento(dataArr: any[], rowIdx: number): Income|null {
		let row = dataArr[rowIdx];
		const prev = dataArr[rowIdx - 1];
		const prevText = prev ? String(prev[0] || "").toLowerCase() : "";
		if(Utils.isPtBrDate(row[0]) && this._isMoney(row[1]) && prevText.indexOf("rendiment") > -1) {
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
		str = (str || "").toLowerCase();
		if(str.indexOf("pix") > -1) return 'pix';
		if(str.indexOf("mast") > -1 || str.indexOf("master") > -1 || str.indexOf("visa") > -1 || str.indexOf("elo") > -1 || str.indexOf("amex") > -1 || str.indexOf("cartao") > -1 || str.indexOf("card") > -1) return 'cartao';
		if(str.indexOf("ifood") > -1 || str.indexOf("ted") > -1 || str.indexOf("doc ") > -1 || str.indexOf("transf") > -1 || str.indexOf("rendiment") > -1) return 'deposito';
		return 'outros';
	}
	private _cardAdditionalInfo(str: string): string|undefined {
		str = (str || "").toLowerCase();
		if(str.indexOf("visa") > -1) return " ((visa))";
		if(str.indexOf("mast") > -1 || str.indexOf("master") > -1) return " ((mastercard))";
		if(str.indexOf("elo") > -1) return " ((elo))";
		if(str.indexOf("amex") > -1) return " ((amex))";
		return undefined;
	}
	private _getOutcomeType(str: string): 'cash'|'boleto'|'check'|'credit_card'|'debit_card'|'pix'|'transfer'|'auto_debit'|'other' {
		str = (str || "").toLowerCase();
		if(str.indexOf("pix") > -1) return 'pix';
		if(str.indexOf("ted") > -1 || str.indexOf("transf") > -1) return 'transfer';

		return 'other';
	}
}