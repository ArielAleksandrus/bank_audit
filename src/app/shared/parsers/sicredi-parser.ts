import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase, PAYMENT_TYPES } from '../models/purchase';
import { Income } from '../models/income';

export class SicrediParser extends BalanceParser {
	dataArr: any[] = [];
	text: string = "";

	override allowsComprovantes = false;
	override acceptedFormats = ".ofx";

	constructor() {
		super();
	}
	override recalculateIncome() {
		this._sumReceita();
	}
	override parseExtrato(dataArr: any[], dataType: 'ofx'): void{
		this.dataArr = dataArr;
		if(!this.dataArr || this.dataArr.length != 1) {
			console.error("SicrediParser: dataArr is invalid. Must contain only 1 element: The whole file as string");
		}

		this.text = dataArr[0];

		switch(dataType) {
		case('ofx'): {
			this.parseOFX();
		}
		}

		this.recalculateIncome();
	}

	parseOFX() {
		this.boletos = [];
		this.purchases = [];
		this.incomes = [];

		this.text = this.text.replace("\n","");
		let rawEntries: string[] = this.text.split("<STMTTRN>");
		for(let i = 1; i < rawEntries.length; i++) {
			this._parseRawEntry(rawEntries[i]);
		}
	}
	/* example of rawEntry:
	 * <TRNTYPE>CREDIT</TRNTYPE>\n
	 * <DTPOSTED>20250401000000[-3:GMT]</DTPOSTED>\n
	 * <TRNAMT>184.00</TRNAMT>\n
	 * <FITID>17376954452</FITID>\n
	 * <REFNUM>17376954452</REFNUM>\n
	 * <MEMO>RECEBIMENTO PIX-PIX_CRED  55494138000186 VANESSA M</MEMO>\n
	 * </STMTTRN>\n
	
	*/
	private _parseRawEntry(rawEntry: string) {
		let value = this._getValue(rawEntry);
		if(value >= 0) {
			let income = new Income({
				id: -Math.floor(Math.random() * 1000000),
				company_id: 0, // server will set this for us
				date_received: this._getDate(rawEntry),
				origin: this._getPerson(rawEntry),
				bank_name: "sicredi",
				bank_identification: this._getBankIdentification(rawEntry),
				income_type: this._getIncomeType(rawEntry),
				value: this._getValue(rawEntry)
			});
			this.incomes.push(income);
		} else {
			// TODO
			// ate agora nao pagamos boletos via sicredi, entao nao vamos criar boletos aqui
			let value: number = Math.abs(this._getValue(rawEntry));
			let purchase = new Purchase({
				id: -Math.floor(Math.random() * 1000000),
				company_id: 0, // server will set this for us
				supplier_id: 0, // server will set this for us
				supplier_name: this._getPerson(rawEntry),
				purchase_date: this._getDate(rawEntry),
				payment_type: this._getPaymentType(rawEntry),
				bank_name: "sicredi",
				base_value: value, // 'despesa' and 'boleto' values are negative. we will fix this now. 
				delivery_fee: 0,
				total: value // 'despesa' and 'boleto' values are negative. we will fix this now. 
			});
			this.purchases.push(purchase);
		}
	}

	// TODO
	// ate agora so usamos o sicredi para receber pix
	// ainda nao sabemos como entradas de recebimento de cartao, cheque, etc, aparecerao no extrato
	private _getIncomeType(rawEntry: string): 'cartao'|'pix'|'deposito'|'cheque'|'outros' {
		const map: any = {
			"RECEBIMENTO PIX": "pix",
			"RECEBIMENTO TED": "deposito",
			"DOC": "deposito"
		};
		let desc: string = rawEntry.split("<MEMO>")[1].split("</")[0];
		for(let key in map) {
			if(desc.indexOf(key) > -1)
				return map[key];
		}

		return "outros";
	}
	private _getPaymentType(desc: string): PAYMENT_TYPES {
		const map: any = {
			"DOC/TED INTERNET PF": "auto_debit",
			"CESTA DE RELACIONAMENTO": "auto_debit",
			"Transação": "transfer",
			"DEBITO TED": "transfer",
			"DEBITO DOC": "transfer"
		}
		for(let key in map) {
			if(desc.indexOf(key) > -1)
				return map[key];
		}
		return "other";
	}
	private _getBankIdentification(rawEntry: string): string {
		return rawEntry.split("<REFNUM>")[1].split("</")[0];
	}
	// desc is 'RECEBIMENTO PIX-PIX_CRED  55490000000186 VANESSA M'
	// so, the person appears right after the number string
	private _getPerson(rawEntry: string): string {
		let desc: string = rawEntry.split("<MEMO>")[1].split("</")[0];
		let words = desc.split(" ");
		for(let i = 0; i < words.length; i++) {
			let num = Number(words[i]);
			if(num > 100000) {
				return words.splice(i + 1).join(" ");
			}
		}
		return desc;
	}
	private _getValue(rawEntry: string): number {
		let value: string = rawEntry.split("<TRNAMT>")[1].split("</")[0];
		return Number(value);
	}
	private _getDate(rawEntry: string) {
		let rawDate: string = rawEntry.split("<DTPOSTED>")[1];
		rawDate = rawDate.split("</")[0];
		rawDate = rawDate.split("[")[0];

		let year = rawDate.substr(0, 4);
		let month = rawDate.substr(4, 2);
		let day = rawDate.substr(6, 2);
		return `${year}-${month}-${day}`;
	}

	private _sumReceita() {
		this.sumReceita = {
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
		// por enquanto não utilizamos máquinas da sicredi
		// vamos nos ater apenas a pix
		const map = {
			/*"MAESTRO": {deb: "master"},
			"MASTERCARD": {cred: "master"},
			"VISA ELECTRON": {deb: "visa"},
			"VISA": {cred: "visa"},
			"DEB OUTRAS BANDEIRAS": {deb: "outros"},
			"CRE OUTRAS BANDEIRAS": {cred: "outros"},*/
		}

		for(let income of this.incomes) {
			let value = Number(income.value);

			switch(income.income_type) {
			case("cartao"): {
				//@ts-ignore
				let match: any = map[income.origin];
				for(let key in map) {
					if(income.origin.indexOf(key) > -1) {
						//@ts-ignore
						match = map[key];
						break;
					}
				}

				if(!match) {
					console.log("SicrediParser->sumReceita: Uncategorized type: " + income.origin, income);
				} else {
					const credOrDeb = Object.keys(match)[0];
					const companyName = match[credOrDeb];
					//@ts-ignore
					this.sumReceita[credOrDeb][companyName] += Number(income.value);
					//@ts-ignore
					this.sumReceita[credOrDeb]["total"] += Number(income.value);
				}
				break;
			}
			case("pix"): {
				this.sumReceita.pix += value;
				break;
			}
			}

			this.sumReceita["total"] += Number(income.value);
		}
	}
}