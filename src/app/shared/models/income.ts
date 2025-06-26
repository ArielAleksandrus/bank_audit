import { Tag } from './tag';
import { ApiService } from '../services/api.service';
import { Utils } from '../helpers/utils';

export type CardCompany = "visa"|"mastercard"|"amex"|"elo"|"outros";
export const CARDCOMPANIES: CardCompany[] = ["visa", "mastercard", "amex", "elo", "outros"];
export type IncomeSummary = {
	credit: {
		visa: number,
		mastercard: number,
		elo: number,
		amex: number,
		outros: number,
		total: number
	},
	debit: {
		visa: number,
		mastercard: number,
		elo: number,
		amex: number,
		outros: number,
		total: number
	},
	other_cards: number,
	pix: number,
	other_incomes: number,
	grandTotal: number
};
export class Income {
	id: number;
	company_id: number;

	income_type: 'cartao'|'pix'|'deposito'|'cheque'|'outros';
	date_received: string;
	value: string|number;
	origin: string;
	bank_name: string;
	bank_identification: string;
	additional_info: string;

	created_at: string;
	updated_at: string;

	// set by our front end app
	auxStatus: 'ok'|'error';

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.company_id = jsonData.company_id;
		this.date_received = jsonData.date_received;
		this.origin = jsonData.origin;
		this.bank_name = jsonData.bank_name;
		this.income_type = jsonData.income_type;
		this.bank_identification = jsonData.bank_identification;
		this.value = jsonData.value;
		this.additional_info = jsonData.additional_info;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
		this.auxStatus = jsonData.auxStatus || 'ok';
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Income(data));
		}
		return res;
	}

  public static sendArray(api: ApiService, incomes: Income[]): Promise<Income[]> {
  	let objs: Income[] = Income.fromJsonArray(Utils.clone(incomes));
  	return Income._auxSendArray(api, objs);
  }
  send(api: ApiService): Promise<Income> {
    return new Promise((resolve, reject) => {

      let req: any = null;
      if(this.id > 0) {
        req = api.update('incomes', this.id, {income: this});
      } else {
        req = api.create('incomes', {income: this});
      }

      req.subscribe(
        (res: Income) => {
        	this.auxStatus = 'ok';
          resolve(new Income(res));
        },
        (err: any) => {
          console.error("Income->Could not save income: ", this, err);
         	this.auxStatus = 'error';
          reject(err);
        }
      );
    })
  }

	public static arrayExists(api: ApiService, incomes: Income[]): Promise<Income[]> {
		let objs: Income[] = Utils.clone(incomes);
		  
		return new Promise((resolve, reject) => {
		  let params = {
		    incomes: Income._arrayExistsParams(incomes)
		  }

		  api.req('incomes', params, {collection: 'exists'}, 'post').subscribe(
		    (res: {incomes: Income[]}) => {
		      for(let i = 0; i < objs.length; i++) {
		        if(res.incomes[i] && res.incomes[i].id > 0) {
		          objs[i] = new Income(res.incomes[i]);
		        }
		      }
		      resolve(Income.fromJsonArray(objs));
		    },
		    (err: any) => {
		      console.error("Income->Erro ao buscar entradas: ", err);
		      reject(err);
		    }
		  );
		});
  }

  public static calculateIncomeSummary(incomes: Income[]): IncomeSummary {
		let incomeSummary = Income.defaultIncomeSummary();
		if(!incomes || incomes.length == 0)
			return incomeSummary;

		for(let income of incomes) {
			let value: number = Number(income.value);

			if(income.income_type == "pix") {
				incomeSummary.pix = Utils.sumDecimals(incomeSummary.pix, value);
			} else if(income.income_type == "cartao") {
				let cardType = Income.getCardType(income.additional_info || "");
				if(cardType.type == "outros") {
					incomeSummary.other_cards = Utils.sumDecimals(incomeSummary.other_cards, value);
				} else if(cardType.type == "debit") {
					//@ts-ignore
					incomeSummary.debit[cardType.company] = Utils.sumDecimals(incomeSummary.debit[cardType.company], value);
					incomeSummary.debit.total = Utils.sumDecimals(incomeSummary.debit.total, value);
				} else if(cardType.type == "credit") {
					//@ts-ignore
					incomeSummary.credit[cardType.company] = Utils.sumDecimals(incomeSummary.credit[cardType.company], value);
					incomeSummary.credit.total = Utils.sumDecimals(incomeSummary.credit.total, value);
				}
			} else {
				incomeSummary.other_incomes = Utils.sumDecimals(incomeSummary.other_incomes, value);
			}

			incomeSummary.grandTotal = Utils.sumDecimals(incomeSummary.grandTotal, value);
		}

		return incomeSummary;
  }
  public static getCardType(description: string): {type: "credit"|"debit"|"outros", company: CardCompany} {
		let res: {type: "credit"|"debit"|"outros", company: CardCompany} = {type: "outros", company: "outros"};

		let companyName = description.split("((")[1];
		if(!companyName)
			return res;

		companyName = companyName.split("))")[0];

		if(companyName == "outros") {
			res = {type: "outros", company: "outros"};
		} else if(companyName.indexOf("débito") > -1) {
			res = {type: "debit", company: Income._checkCompanyName(companyName)};
		} else {
			res = {type: "credit", company: Income._checkCompanyName(companyName)};
		}
		return res;
	}
	public static defaultIncomeSummary(): IncomeSummary {
		return {
			credit: {
				visa: 0,
				mastercard: 0,
				elo: 0,
				amex: 0,
				outros: 0,
				total: 0
			},
			debit: {
				visa: 0,
				mastercard: 0,
				elo: 0,
				amex: 0,
				outros: 0,
				total: 0
			},
			other_cards: 0,
			other_incomes: 0,
			pix: 0,
			grandTotal: 0
		};
	}


	//////////// PRIVATE METHODS ////////////////

	private static _checkCompanyName(companyName: string): CardCompany {
		companyName = companyName.split(" ")[0]; // will not include "debito" word.
		for(let comp of CARDCOMPANIES) {
			if(comp == companyName)
				return comp;
		}
		return "outros";
	}
	private _existsParams() {
		return {
			bank_name: this.bank_name,
			bank_identification: this.bank_identification,
			date_received: this.date_received,
			value: this.value,
			origin: this.origin,
			income_type: this.income_type
		};
	}
	private static _arrayExistsParams(incomes: Income[]) {
		let arr = [];
		for(let obj of incomes) {
			arr.push(obj._existsParams());
		}
		return arr;
	}
  private static _auxSendArray(api: ApiService, incomes: Income[], idx: number = 0): Promise<Income[]> {
  	return new Promise((resolve, reject) => {
  		if(idx >= incomes.length) {
  			resolve(Income.fromJsonArray(incomes));
  			return;
  		}
  		let income = incomes[idx];
  		income.send(api).then(res => {
  			incomes[idx] = res;
  			resolve(Income._auxSendArray(api, incomes, idx + 1));
  		}).catch(err => {
  			resolve(Income._auxSendArray(api, incomes, idx + 1));
  		});
  	});
  }
}