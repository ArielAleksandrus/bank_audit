import { Tag } from './tag';
import { ApiService } from '../services/api.service';
import { Utils } from '../helpers/utils';

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


	//////////// PRIVATE METHODS ////////////////
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