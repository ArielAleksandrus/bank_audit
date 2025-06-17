import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase, PAYMENT_TYPES } from '../models/purchase';
import { Income } from '../models/income';

export type StoneExcelEntry = {
    "Movimentação": "Débito"|"Crédito",
    "Tipo": "Pix"|"Recebível de Cartão"|"Transação"|"Pagamento"|"TED", // what we found out so far...
    "Valor": string, //"-1.710,00", 
    "Saldo antes": string, //"R$ 78.536,58",
    "Saldo depois": string, //"R$ 76.826,58",
    "Tarifa": "Grátis"|string, //"Grátis", "R$ 0,00", "R$ 1,20"
    "Data": string, //"30/04/2025 14:31",
    "Situação": "Enviado"|"FINISHED",
    "Destino": string, // "GRACIELE F",
    "Destino Documento": string, // "42.xxx.xxx/xxxx-63",
    "Destino Instituição": string, //"COOPERATIVA DE CRÉDITO DE LIVRE ADMISSÃO DO CENTRO NORTE BRASILEIRO",
    "Destino Agência": string, // "Desconhecido",
    "Destino Conta": string, // "Desconhecido",
    "Origem": string, // "El mare",
    "Origem Documento": string, // "45.xxx.xxx/xxxx-12",
    "Origem Instituição": string, // "Stone Instituição de Pagamento S.A.",
    "Origem Agência": string, // "0001",
    "Origem Conta": string, // "54xxxx-0"
};
export class StoneParser extends BalanceParser {
	dataArr: any[] = [];

	override allowsComprovantes = false;

	constructor() {
		super();
	}
	override recalculateIncome() {
		this._sumReceita();
	}
	override parseExtrato(dataArr: any[], dataType: 'excel'): void{
		this.dataArr = dataArr;

		switch(dataType) {
		case('excel'): {
			this.parseExcel();
		}
		}
	}

	parseExcel() {
		if(!this.dataArr || this.dataArr.length < 2) {
			console.error("StoneParser: dataArr is too small");
		}

		this._parseExcelRows();
	}
	private _parseExcelRows() {
		this.boletos = [];
		this.incomes = [];
		this.purchases = [];
		
		for(let i = 0; i < this.dataArr.length; i++) {
			let entry: StoneExcelEntry = this.dataArr[i];
			if(entry["Movimentação"] == "Crédito") {
				let income = new Income({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					date_received: (Utils.datePtBrToISO(entry["Data"]) || "").split(" ")[0],
					origin: entry["Origem"],
					bank_name: "stone",
					// bank_identification: stone doesnt give us bank identification number
					income_type: this._getIncomeType(entry["Tipo"]),
					value: this._fixValue(entry["Valor"])
				});
				this.incomes.push(income);
			} else if(entry["Movimentação"] == "Débito") {
				let purchase = new Purchase({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					supplier_id: 0, // server will set this for us
					supplier_name: entry["Destino"],
					purchase_date: (Utils.datePtBrToISO(entry["Data"]) || "").split(" ")[0],
					payment_type: this._getPaymentType(entry["Tipo"]),
					bank_name: "stone",
					base_value: this._fixValue(entry["Valor"], true), // 'despesa' and 'boleto' values are negative. we will fix this now. 
					delivery_fee: 0,
					total: this._fixValue(entry["Valor"], true) // 'despesa' and 'boleto' values are negative. we will fix this now. 
				});
				if(purchase.payment_type == "boleto") {
					let bol = new Boleto({
						id: -Math.floor(Math.random() * 1000000),
						purchase_id: 0, // we will set this later
						bank_name: "stone",
						//bank_identification: stone doesnt give us that,
						// expiration_date: stone doesnt give us that
						// issue_date: stone doesnt give us that
						value: purchase.total, // 'despesa' and 'boleto' values are negative. we will fix this now. 
						// installments: we don't know this yet
						payment_date: (Utils.datePtBrToISO(entry["Data"]) || "").split(" ")[0],
						supplier_name: purchase.supplier_name
					});
					this.boletos.push(bol);
				} else {
					this.purchases.push(purchase);
				}
			} else {
				console.error(`StoneParser->Unknown Movimentação "${entry["Movimentação"]}"`, entry);
			}
		}
		this._sumReceita();
	}
	private _fixValue(valStr: string, removeSignal: boolean = false): string {
		valStr = valStr.replace(".","").replace(",",".").replace(" ",""); // '-50.000,01' will become '-50000.01'
		if(removeSignal)
			valStr = valStr.replace("-","");
		return Number(valStr).toFixed(2);
	}
	private _getIncomeType(incomeType: string): 'cartao'|'pix'|'deposito'|'cheque'|'outros' {
		const map: any = {
			"Pix": "pix",
			"Recebível de Cartão": "cartao",
			"Transação": "deposito",
			"TED": "deposito",
			"DOC": "deposito"
		}
		let res = map[incomeType];
		if(!res)
			res = "outros";

		return res;
	}
	private _getPaymentType(paymentType: string): PAYMENT_TYPES {
		const map: any = {
			"Pix": "pix",
			"Pagamento": "boleto",
			"Transação": "transfer",
			"TED": "transfer",
			"DOC": "transfer"
		}
		let res = map[paymentType];
		if(!res)
			res = "other";

		return res;
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
		// a stone não informa a instituição que fez o pagamento de cartão
		// o resultado, por enquanto, é sempre "Desconhecido"
		const map = {
			/*"MAESTRO": {deb: "master"},
			"MASTERCARD": {cred: "master"},
			"VISA ELECTRON": {deb: "visa"},
			"VISA": {cred: "visa"},
			"DEB OUTRAS BANDEIRAS": {deb: "outros"},
			"CRE OUTRAS BANDEIRAS": {cred: "outros"},*/
			"Desconhecido": {cred: "outros"}
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
					console.log("StoneParser->sumReceita: Uncategorized type: " + income.origin, income);
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