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
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Income(data));
		}
		return res;
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
          resolve(res);
        },
        (err: any) => {
          console.error("Income->Could not save income: ", this, err);
          reject(err);
        }
      );
    })
  }

	existsParams() {
		return {
			bank_name: this.bank_name,
			bank_identification: this.bank_identification,
			date_received: this.date_received,
			value: this.value,
			origin: this.origin,
			income_type: this.income_type
		};
	}

	public static arrayExists(api: ApiService, incomes: Income[]): Promise<Income[]> {
		let objs: Income[] = Utils.clone(incomes);
		  
		return new Promise((resolve, reject) => {
		  let params = {
		    incomes: Income.arrayExistsParams(incomes)
		  }

		  api.req('incomes', params, {collection: 'exists'}, 'post').subscribe(
		    (res: {incomes: Income[]}) => {
		      for(let i = 0; i < objs.length; i++) {
		        if(res.incomes[i] && res.incomes[i].id > 0) {
		          objs[i] = new Income(res.incomes[i]);
		        }
		      }
		      resolve(objs);
		    },
		    (err: any) => {
		      console.error("Income->Erro ao buscar entradas: ", err);
		      reject(err);
		    }
		  );
		});
  }
	public static arrayExistsParams(incomes: Income[]) {
		let arr = [];
		for(let obj of incomes) {
			arr.push(obj.existsParams());
		}
		return arr;
	}
}