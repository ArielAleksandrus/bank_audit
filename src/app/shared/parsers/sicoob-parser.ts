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
		receita_pix: ["PIX RECEBIDO", "TRANSF.RECEBIDA"],
		receita_ted: ["CRÉD.TED", "CRED.TED", "CRÉD. TED"],
		seguro: ["DÉB. CONV. SEGURO", "DÉB.CONV.SEGURO"]
		// anything else will be either 'receita' (if value > 0) or 'despesa' (if value <= 0)
	};

	boletoColsIndexes = {
		date: 0,
		bank_identification: 1,
		description: 2,
		value: 3,
		complementary: -1,
		type: 4,
		tags: 5
	};

	comprovantesArr: {
		documento: string,
		beneficiario: string,
		cnpj: string,
		data_pagamento: string,
		data_vencimento: string,
		valor: number
	}[] = [];
  comprovantesPixArr: {
    tipo: 'pix'|'transfer',
    beneficiario: string,
    data_pagamento: string,
    valor: number
  }[] = [];

	constructor() {
		super();
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

    console.log(this);
		
		this.recalculateIncome();
	}
	override parseComprovantes(text: string): any {
    this.comprovantesArr = [];
    this.comprovantesPixArr = [];
    this._parseBoletos(text);
    this._parsePayments(text);
    
    this._addBeneficiario();
    this.recalculateIncome();

		return this.comprovantesArr;
	}
  private _parsePayments(text: string): any {
    this._parsePixEfetivacao(text);
    this._parseTransferenciaLegacy(text);
    console.log(this.comprovantesPixArr, this.purchases);
  }
  private _parsePixEfetivacao(text: string): void {
    const parts = text.split(/COMPROVANTE DE EFETIVAÇÃO DE PAGAMENTO PIX/i);
    for(let i = 1; i < parts.length; i++) {
      const raw = parts[i];
      const dest = raw.split(/Destinatário/i)[1];
      if(!dest)
        continue;

      const nomeMatch = dest.match(/Nome\s+([^\n]+)/i);
      const dateMatch = raw.match(/Data do pagamento\s+(\d{2}\/\d{2}\/\d{4})/i);
      const valMatch = raw.match(/Valor\s*R\$\s*([\d.]+,\d{2})/i);
      if(!nomeMatch || !dateMatch || !valMatch)
        continue;

      this.comprovantesPixArr.push({
        tipo: "pix",
        beneficiario: nomeMatch[1].trim(),
        data_pagamento: dateMatch[1],
        valor: this._parseBrl(valMatch[1])
      });
    }
  }
  private _parseTransferenciaLegacy(text: string): void {
    const rawArr = text.split("COMPROVANTE DE TRANSFERÊNCIA");
    for(let i = 1; i < rawArr.length; i++) {
      try {
        const chunk = rawArr[i];
        const natureza = (chunk.split("Natureza")[1] || "").toLowerCase();
        const beneficiario = chunk.split("\nAutenticação")[0].split("Conta")[2].split(" / ")[1];
        const dataRaw = chunk.toLowerCase().split("data do agendamento ")[1].split("\n")[0];
        const dateMatch = dataRaw.match(/\d{2}\/\d{2}\/\d{4}/);
        this.comprovantesPixArr.push({
          tipo: natureza.indexOf("pix") > -1 ? "pix" : "transfer",
          beneficiario: beneficiario,
          data_pagamento: dateMatch ? dateMatch[0] : dataRaw.trim(),
          valor: this._parseBrl(chunk.split("Valor R$ ")[1].split("\n")[0])
        });
      } catch (err) {
        console.log("SicoobParser::_parseTransferenciaLegacy skipped chunk", err);
      }
    }
  }
  private _parseBrl(str: string): number {
    return Number.parseFloat(String(str).trim().replace(/\./g, "").replace(",", "."));
  }
  private _parseBoletos(text: string): any {
    let boletosRawArr = text.split("Número do agendamento");

    for(let i = 1; i < boletosRawArr.length; i++) {
      let boletoRaw = boletosRawArr[i];

      boletoRaw = boletoRaw.replace("\t", " ")

      let beneficiario = boletoRaw.split("Nome/Razão Social ")[1];

      if(beneficiario)
        beneficiario = beneficiario.split("\n")[0];
      else
        continue;

      if(!!boletoRaw.split("Beneficiário final\nNome/Razão social ")[1])
        beneficiario = boletoRaw.split("Beneficiário final\nNome/Razão social ")[1].split("\n")[0];

      beneficiario = beneficiario.replace("\n", "");

      let supplierCnpj = boletoRaw.split('CPF/CNPJ ')[1].split('\n')[0];
      if(supplierCnpj)
        supplierCnpj = supplierCnpj.replace('.','').replace('-','').replace('/','');

      this.comprovantesArr.push({
        documento: boletoRaw.split(' ')[1].split('\n')[0],
        beneficiario: beneficiario,
        cnpj: supplierCnpj,
        data_pagamento: boletoRaw.split("Datas\nRealizado ")[1].split(" às ")[0],
        data_vencimento: boletoRaw.split("Vencimento ")[1].split("\n")[0],
        valor: Number.parseFloat(boletoRaw.split("\nPago  R$ ")[1].split("\n")[0].replace('.','').replace(',','.'))
      });
    }
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
		if(this.parsedRows.length == 0)
			return;

		for(let boleto of this.boletos) {
			let comprovanteObj = Utils.findById(boleto.bank_identification, this.comprovantesArr, 'documento');

			if(!comprovanteObj) {
				continue;
			}

			boleto.payment_date = Utils.datePtBrToISO(comprovanteObj.data_pagamento) || '1900-10-10';
			boleto.expiration_date = Utils.datePtBrToISO(comprovanteObj.data_vencimento) || '1900-10-10';
			// a data da compra não é a data do pagamento, porém esta informação é obrigatória e não consta no comprovante!
			boleto.issue_date = boleto.payment_date;
			boleto.supplier_cnpj = comprovanteObj.cnpj;
			boleto.supplier_name = comprovanteObj.beneficiario;
		}
    for(let pix of this.comprovantesPixArr) {
      const isoDate = (Utils.datePtBrToISO(pix.data_pagamento) || "").split(" ")[0];
      const amount = Number(Number(pix.valor).toFixed(2));
      const foundArr = this.purchases.filter(item =>
        item.purchase_date == isoDate && Number(Number(item.total).toFixed(2)) == amount
      );
      if(foundArr.length == 0) {
        console.log("SicoobParser::_addBeneficiario -> Não encontrado item pix: ", pix);
        continue;
      }
      foundArr[0].payment_type = pix.tipo;
      foundArr[0].supplier_name = pix.beneficiario;
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
		this._resolveColIndexes();
	}
	private _headerIndex(name: string, fallback: number): number {
		const idx = this.parsedHeaders.indexOf(name);
		return idx >= 0 ? idx : fallback;
	}
	private _resolveColIndexes() {
		this.boletoColsIndexes.date = this._headerIndex("DATA", 0);
		this.boletoColsIndexes.bank_identification = this._headerIndex("DOCUMENTO", 1);
		this.boletoColsIndexes.description = this._headerIndex("HISTÓRICO", 2);
		this.boletoColsIndexes.value = this._headerIndex("VALOR", 3);
		this.boletoColsIndexes.complementary = this._headerIndex("INFORMAÇÕES COMPLEMENTARES", -1);
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
	}
	private _fixPaymentValue() {
		const valorIdx = this.boletoColsIndexes.value;
		if(valorIdx < 0)
			return;

		for(let row of this.parsedRows) {
			let valStr = row[valorIdx];
			let nbSpace = String.fromCharCode(160);


			if(typeof valStr == "number") {
				row[valorIdx] = valStr;
				continue;
			}

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
		const complementaryIdx = this.boletoColsIndexes.complementary;

		for(let row of this.parsedRows) {
			const desc = String(row[descIdx] || "");
			let valueField = row[valueIdx];
			if(typeof valueField == "string") {
				valueField = row[valueIdx + 1];
			}
			if(typeof valueField != "number" || Number.isNaN(valueField))
				continue;

			const type = this._getDescriptionType(desc, valueField);
			const complementary = complementaryIdx >= 0 ? row[complementaryIdx] : "";
			
			if(desc.indexOf("SALDO") == 0)
				continue;

			if(type == "boleto" || type == "despesa" || type == "seguro") {
				const person = this._personFromComplementary(complementary);
				let purchase = new Purchase({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					supplier_id: 0, // server will set this for us
					supplier_name: person || desc,
					purchase_date: Utils.datePtBrToISO(row[dateIdx]),
					payment_type: this._getPaymentType(desc),
					bank_name: "sicoob",
					base_value: -valueField.toFixed(2), // 'despesa' and 'boleto' values are negative. we will fix this now. 
					delivery_fee: 0,
					total: -valueField.toFixed(2) // 'despesa' and 'boleto' values are negative. we will fix this now. 
				});

				if(type == "boleto") {
					let boleto = new Boleto({
						id: -Math.floor(Math.random() * 1000000),
						purchase_id: 0, // we will set this later
						bank_name: "sicoob",
						bank_identification: row[identificationIdx],
						// expiration_date: we don't know this yet
						// issue_date: we don't know this yet
						value: -valueField.toFixed(2), // 'despesa' and 'boleto' values are negative. we will fix this now. 
						// installments: we don't know this yet
						payment_date: Utils.datePtBrToISO(row[dateIdx]),
						supplier_name: person || desc
					});
					boleto.auxTags = [];
					purchase.boletos = [boleto];
					purchase.payment_type = 'boleto';
					this.boletos.push(boleto);
				} else {
					// boleto's purchase was already added to boletos.
					// any other purchase will be stored in purchases variable
					this.purchases.push(purchase);
				}
			} else if(type && type.indexOf("receita") > -1) {
				let cardType: string|null = type.split("receita_cartao ")[1];
				if(cardType)
					cardType = cardType.trim();
				const person = this._personFromComplementary(complementary);
				let income: Income = new Income({
					id: -Math.floor(Math.random() * 1000000),
					company_id: 0, // server will set this for us
					date_received: Utils.datePtBrToISO(row[dateIdx]),
					origin: person || desc,
					bank_name: "sicoob",
					// bank_identification: we don't know this yet
					income_type: "outros",
					value: valueField.toFixed(2)
				});

				if(cardType) {
					income.origin = cardType;
					income.additional_info = (income.additional_info || "") + " ((" + this._getCardCompany(cardType) + "))";
					income.income_type = 'cartao';
				} else if(type == 'receita_pix') {
					income.income_type = 'pix';
				} else if(type == 'receita_ted') {
					income.income_type = 'deposito';
				}
				this.incomes.push(income);
			} else {
				console.error("SicoobParser->classifyDescription: row is not receita nor despesa. it is: " + type, row);
			}
		}
	}
	private _getPaymentType(desc: string): 'boleto'|'pix'|'transfer'|'auto_debit'|'other' {
		const upper = (desc || "").toUpperCase();
		if(upper.indexOf("PIX") > -1)
			return 'pix';
		if(upper.indexOf("TRANSF") > -1)
			return 'transfer';
		if(upper.indexOf("CONV.") > -1 || upper.indexOf("DÉBITO PACOTE") > -1 || upper.indexOf("DEB.PARCELAS") > -1)
			return 'auto_debit';
		return 'other';
	}
	private _personFromComplementary(text: any): string|null {
		if(!text || typeof text != "string")
			return null;

		const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
		for(let line of lines) {
			if(/^(recebimento|pagamento)\s+pix/i.test(line))
				continue;
			if(/^\*+\.\d+\.\d+-\*+$/.test(line))
				continue;
			if(/^\d{2}\.\d{3}\.\d{3}/.test(line) || /^\d{2}\s+\d{3}\s+\d{3}/.test(line))
				continue;
			return line;
		}
		return null;
	}
	private _getCardCompany(cardType: string) {
		const normalized = (cardType || "").trim();
		const map: {[companyName:string]: string} = {
			"MAESTRO": "mastercard débito",
			"MASTERCARD": "mastercard",
			"VISA ELECTRON": "visa débito",
			"VISA": "visa",
			"DEB OUTRAS BANDEIRAS": "outros débito",
			"CRE OUTRAS BANDEIRAS": "outros"
		};

		let match: string = map[normalized];
		if(!match) {
			match = "outros";
		}

		return match;
	}
}
