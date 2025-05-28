import { BalanceParser } from './balance-parser';

import { Utils } from '../helpers/utils';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';


/**
 * EXCEL ASSUMPTIONS:
 * 	1. first row will contain header cols, and one of them will be named VALOR and other will be HISTÓRICO
 * 	
 */

export class SicoobParser extends BalanceParser {
	dataArr: any[] = [];

	parsedHeaders: string[] = [];
	parsedRows: any[] = [];

	descriptions = {
		boleto: ["DÉB.TIT", "DÉB.TÍT", "DÉB. PAGAMENTO DE BOLETO"],
		receita_cartao: ["CR COMPRAS"],
		receita_pix: ["PIX RECEBIDO"],
		seguro: ["DÉB. CONV. SEGURO"]
		// anything else will be either 'receita' (if value > 0) or 'despesa' (if value <= 0)
	};

	////// TODO: CHECK IF UNCHANGED
	boletoColsIndexes = {
		date: 0,
		bank_identification: 1,
		description: 2,
		value: 3,
		type: 4,
		tags: 5
	};
	////////////

	comprovantesArr: {
		documento: string,
		beneficiario: string,
		cnpj: string,
		data_pagamento: string,
		data_vencimento: string,
		valor: number
	}[] = [];

	constructor() {
		super();
	}
	override recalculateIncome() {
		this._sumReceita();
	}
	override parseExtrato(dataArr: any[], dataType: 'excel'): void{
		this.dataArr = dataArr;
		this.parsedHeaders = [];
		this.parsedRows = [];

		switch(dataType) {
		case('excel'): {
			this.parseExcel();
		}
		}
	}
	override parseComprovantes(text: string): any {
		this.comprovantesArr = [];
		let boletosRawArr = text.split("Número do agendamento");

		for(let i = 1; i < boletosRawArr.length; i++) {
			let boletoRaw = boletosRawArr[i];

			let beneficiario = boletoRaw.split("Nome/Razão Social\t")[1].split("\n")[0];
			if(!!boletoRaw.split("Beneficiário final\nNome/Razão social\t")[1])
				beneficiario = boletoRaw.split("Beneficiário final\nNome/Razão social\t")[1].split("\n")[0];

			let supplierCnpj = boletoRaw.split('CPF/CNPJ\t')[1].split('\n')[0];
			if(supplierCnpj)
				supplierCnpj = supplierCnpj.replace('.','').replace('-','').replace('/','');

			this.comprovantesArr.push({
				documento: boletoRaw.split('\t')[1].split('\n')[0],
				beneficiario: beneficiario,
				cnpj: supplierCnpj,
				data_pagamento: boletoRaw.split("Datas\nRealizado\t")[1].split(" às ")[0],
				data_vencimento: boletoRaw.split("Vencimento\t")[1].split("\n")[0],
				valor: Number.parseFloat(boletoRaw.split("\nPago\tR$ ")[1].split("\n")[0].replace('.','').replace(',','.'))
			});
		}
		this._addBeneficiario();

		return this.comprovantesArr;
	}

	parseExcel() {
		if(!this.dataArr || this.dataArr.length < 2) {
			console.error("SicoobParser: dataArr is too small");
		}

		this._parseExcelHeader();
		this._parseExcelRows();
		this._addBeneficiario();
	}

	private _addBeneficiario() {
		if(this.parsedRows.length == 0 || this.comprovantesArr.length == 0)
			return;

		for(let boleto of this.boletos) {
			let comprovanteObj = Utils.findById(boleto.bank_identification, this.comprovantesArr, 'documento');
			boleto.payment_date = Utils.datePtBrToISO(comprovanteObj.data_pagamento) || '1900-10-10';
			boleto.expiration_date = Utils.datePtBrToISO(comprovanteObj.data_vencimento) || '1900-10-10';
			// a data da compra não é a data do pagamento, porém esta informação é obrigatória e não consta no comprovante!
			boleto.issue_date = boleto.payment_date;
			boleto.supplier_cnpj = comprovanteObj.cnpj;
			boleto.supplier_name = comprovanteObj.beneficiario;
		}
	}
	private _parseExcelHeader() {
		this.parsedHeaders = [];
		// row 0 shows us the header columns
		for(let key in this.dataArr[0]) {
			if(key == "__rowNum__")
				continue;

			this.parsedHeaders.push(this.dataArr[0][key]);
		}
	}
	private _parseExcelRows() {
		this.parsedRows = [];
		// rows with less than header.count cols are information like "Saldo do Dia: " and is not considered
		const colsQty = this.parsedHeaders.length; // __rowNum__ is not counted in Utils.countKeys
		for(let i = 1; i < this.dataArr.length; i++) {
			let row = this.dataArr[i];

			if(Utils.countKeys(row) < colsQty)
				continue;

			let aux = [];
			for(let key in row) {
				if(key == "__rowNum__")
					continue;
				aux.push(row[key]);
			}
			
			if(aux[0] == '')
				continue;

			this.parsedRows.push(aux);
		}
		this._fixPaymentValue();
		this._classifyDescription();
		this._sumReceita();
	}
	private _fixPaymentValue() {
		const valorIdx = this.parsedHeaders.indexOf("VALOR");

		for(let row of this.parsedRows) {
			let valStr = row[valorIdx];
			let nbSpace = String.fromCharCode(160);
			valStr = valStr.replace(".","").replace(",",".").replace(" ","").replace(nbSpace,""); // '- 16.309,27 D' will become '-16309.27D'
			if(valStr.indexOf("D") > -1) {
				if(valStr[0] != '-')
					valStr = '-' + valStr;
			}
			// remove 'C' and 'D' letters
			valStr = valStr.split("C").join("");
			valStr = valStr.split("D").join("");

			row[valorIdx] = Number.parseFloat(valStr);
		}
	}

	private _getDescriptionType(desc: string, value: string|number) {
		for(let type in this.descriptions) {
			//@ts-ignore
			for(let match of this.descriptions[type]) {
				if(type == "receita_cartao" && !!desc.split(match)[1]) {
					return "receita_cartao" + desc.split(match)[1];
				}
				if(desc.indexOf(match) > -1) {
					return type;
				}
			}
		}

		let val = Number(value);
		if(val > 0)
			return "receita"
		else
			return "despesa";
	}
	private _classifyDescription() {
		const descIdx = this.boletoColsIndexes.description;
		const valueIdx = this.boletoColsIndexes.value;
		const identificationIdx = this.boletoColsIndexes.bank_identification;
		const dateIdx = this.boletoColsIndexes.date;

		for(let row of this.parsedRows) {
			const desc = row[descIdx];
			const type = this._getDescriptionType(desc, row[valueIdx]);
			
			if(row[descIdx].indexOf("SALDO") == 0)
				continue;

			if(type == "boleto" || type == "despesa" || type == "seguro") {
				let purchase = new Purchase({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					supplier_id: 0, // server will set this for us
					supplier_name: desc,
					purchase_date: Utils.datePtBrToISO(row[dateIdx]),
					bank_name: "sicoob",
					base_value: -row[valueIdx], // 'despesa' and 'boleto' values are negative. we will fix this now. 
					delivery_fee: 0,
					total: -row[valueIdx] // 'despesa' and 'boleto' values are negative. we will fix this now. 
				});

				if(type == "boleto") {
					let boleto = new Boleto({
						id: -Math.floor(Math.random() * 1000000),
						purchase_id: 0, // we will set this later
						bank_name: "sicoob",
						bank_identification: row[identificationIdx],
						// expiration_date: we don't know this yet
						// issue_date: we don't know this yet
						value: -row[valueIdx], // 'despesa' and 'boleto' values are negative. we will fix this now. 
						// installments: we don't know this yet
						payment_date: Utils.datePtBrToISO(row[dateIdx]),
						supplier_name: row[descIdx]
					});
					boleto.auxTags = [];
					purchase.boletos = [boleto];
					this.boletos.push(boleto);
				} else {
					// boleto's purchase was already added to boletos.
					// any other purchase will be stored in purchases variable
					this.purchases.push(purchase);
				}
			} else if(type && type.indexOf("receita") > -1) {
				let cardType: string|null = type.split("receita_cartao ")[1];
				let income: Income = new Income({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					date_received: Utils.datePtBrToISO(row[dateIdx]),
					origin: desc,
					bank_name: "sicoob",
					// bank_identification: we don't know this yet
					// income_type: we might not know this yet
					value: row[valueIdx]
				});

				if(cardType) {
					income.origin = cardType;
					income.income_type = 'cartao';
				} else if(type == 'receita_pix') {
					income.income_type = 'pix';
				}
				this.incomes.push(income);
			} else {
				console.error("SicoobParser->classifyDescription: row is not receita nor despesa. it is: " + type, row);
			}
		}
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
		const map = {
			"MAESTRO": {deb: "master"},
			"MASTERCARD": {cred: "master"},
			"VISA ELECTRON": {deb: "visa"},
			"VISA": {cred: "visa"},
			"DEB OUTRAS BANDEIRAS": {deb: "outros"},
			"CRE OUTRAS BANDEIRAS": {cred: "outros"}
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
					console.log("SicoobParser->sumReceita: Uncategorized type: " + income.origin, income);
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