import { Boleto } from './boleto';
import { Tag } from './tag';
import { Utils } from '../helpers/utils';
import { ApiService } from '../services/api.service';

export type PAYMENT_TYPES = 'cash'|'boleto'|'check'|'credit_card'|'debit_card'|'pix'|'transfer'|'auto_debit'|'other';
export var PAYMENT_TRANSLATION: {[english: string]: string} = {
	'cash': 'dinheiro',
	'boleto': 'boleto',
	'check': 'cheque',
	'credit_card': 'crédito',
	'debit_card': 'débito',
	'pix': 'pix',
	'transfer': 'transferência',
	'auto_debit': 'débito automático',
	'other': 'outro',
};

export class Purchase {
	id: number;
	company_id: number;
	supplier_id: number;

	bank_name: string;
	payment_type: PAYMENT_TYPES;
	referral: string;

	base_value: string|number;
	delivery_fee: string|number;
	total: string|number;
	installments: number; // the number of installments (defaults to 1)

	purchase_date: string;

	additional_info: string;

	created_at: string;
	updated_at: string;

	boletos: Boleto[];
	tags: Tag[];
	aux_tags: {id: number, name: string}[];

	// set up by our front end app
	supplier_name: string;
	supplier_cnpj: string;
	tagsStr: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.company_id = jsonData.company_id;
		this.supplier_id = jsonData.supplier_id;
		this.supplier_name = jsonData.supplier_name;
		this.supplier_cnpj = jsonData.supplier_cnpj;
		this.bank_name = jsonData.bank_name;
		this.payment_type = jsonData.payment_type;
		this.installments = jsonData.installments || 1;
		this.referral = jsonData.referral;
		this.base_value = jsonData.base_value;
		this.delivery_fee = jsonData.delivery_fee;
		this.total = jsonData.total;
		this.purchase_date = jsonData.purchase_date;
		this.boletos = jsonData.boletos;
		this.tags = jsonData.tags;
		this.aux_tags = jsonData.aux_tags;
		this.additional_info = jsonData.additional_info;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;

		this.tagsStr = "";
		for(let tag of (this.tags || [])) {
			this.tagsStr += tag.name + ", "
		}
		if(this.tagsStr.length > 2) {
			this.tagsStr = this.tagsStr.split("").splice(0, this.tagsStr.length - 2).join("");
		}
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Purchase(data));
		}
		return res;
	}
	
  send(api: ApiService, avoidDuplicates: boolean = true): Promise<Purchase> {
    return new Promise((resolve, reject) => {
      let req: any = null;
      if(this.id > 0) {
        req = api.update('purchases', this.id, {purchase: this});
      } else {
        req = api.create('purchases', {
          purchase: this,
          avoid_duplicates: avoidDuplicates
        });
      }

      req.subscribe(
        (res: Purchase) => {
          resolve(res);
        },
        (err: any) => {
          console.error("Purchase->Could not save purchase: ", this, err);
          reject(err);
        }
      );
    })
  }

	existsParams() {
		return {
			purchase_date: this.purchase_date,
			supplier_name: this.supplier_name,
			base_value: this.base_value,
			total: this.total
		};
	}
	public static getSupplierNames(purchases: Purchase[]): string[] {
		let arr: string[] = [];

		for(let purchase of purchases) {
			Utils.pushIfNotExists(arr, purchase.supplier_name);
		}

		return arr;
	}
	public static arrayExists(api: ApiService, purchases: Purchase[]): Promise<Purchase[]> {
		let objs = Utils.clone(purchases);
		
		return new Promise((resolve, reject) => {
		  let params = {
		    purchases: Purchase.arrayExistsParams(purchases)
		  }

		  api.req('purchases', params, {collection: 'exists'}, 'post').subscribe(
		    (res: {purchases: Purchase[]}) => {
		      for(let i = 0; i < objs.length; i++) {
		        if(res.purchases[i] && res.purchases[i].id > 0) {
		          objs[i] = new Purchase(res.purchases[i]);
		        }
		      }
		      Tag.loadSuggestions(api, Purchase.getSupplierNames(objs)).then((suggestions: {[supplierName: string]: Tag[]}) => {
		        for(let purchase of objs) {
		          let suggestedTags: Tag[] = suggestions[purchase.supplier_name];
		          if(suggestedTags) {
		            purchase.tags = Utils.clone(suggestedTags);
		            purchase.aux_tags = Utils.clone(suggestedTags);
		          }
		        }
		        resolve(objs);
		      }, (tagError: any) => {
		      	console.log("Purchase->Could not load tags suggestions: ", tagError);
		      	resolve(objs);
		      });
		    },
		    (err: any) => {
		      alert("Erro ao buscar boletos existentes");
		      console.error(err);
		    }
		  );
		});
  }
	public static arrayExistsParams(purchases: Purchase[]) {
		let arr = [];
		for(let obj of purchases) {
			arr.push(obj.existsParams());
		}
		return arr;
	}
	public static fromBoleto(boleto: Boleto) {
		const today = (Utils.dateToISO(new Date()) || "1900-01-01 00:00:00").split(" ")[0];

		return new Purchase({
			supplier_name: boleto.supplier_name,
			supplier_cnpj: boleto.supplier_cnpj,
			bank_name: boleto.bank_name,
			payment_type: "boleto",
			installments: 1,
			purchase_date: boleto.issue_date || boleto.payment_date || boleto.expiration_date || today,
			base_value: boleto.value,
			aux_tags: boleto.auxTags
		});
	}
}