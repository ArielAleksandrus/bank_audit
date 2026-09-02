import { Boleto, Tag } from './index';
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
	auxStatus: 'ok'|'error';
	hidden: boolean = false;

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
		this.auxStatus = jsonData.auxStatus || 'ok';
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Purchase(data));
		}
		return res;
	}

	setTags(tags: Tag[]) {
		this.tags = this.aux_tags = tags;
	}
	
  // Sends the whole array in a single request; the server creates/updates
  // each purchase one by one and reports a per-item result back, in order.
  public static sendArray(api: ApiService, purchases: Purchase[], avoidDuplicates: boolean = true): Promise<Purchase[]> {
  	let objs: Purchase[] = Purchase.fromJsonArray(Utils.clone(purchases));
  	if(objs.length == 0) {
  		return Promise.resolve(objs);
  	}

  	return new Promise((resolve, reject) => {
  		api.req('purchases', {purchases: objs, avoid_duplicates: avoidDuplicates}, {collection: 'batch'}, 'post').subscribe(
  			(res: any[]) => {
  				for(let i = 0; i < objs.length; i++) {
  					let entry = res[i];
  					if(!entry) continue;

  					if(entry.errors) {
  						objs[i].auxStatus = 'error';
  					} else {
  						objs[i] = new Purchase(entry);
  					}
  				}
  				resolve(objs);
  			},
  			(err: any) => {
  				console.error("Purchase->Could not save batch: ", err);
  				objs.forEach(purchase => purchase.auxStatus = 'error');
  				reject(err);
  			}
  		);
  	});
  }
  destroy(api: ApiService): Promise<boolean> {
  	return new Promise((resolve, reject) => {
  		if(this.id > 0) {
  			api.destroy('purchases', this.id).subscribe(
  				(res: any) => {
  					resolve(true);
  				},
  				(err: any) => {
  					console.error("Purchase->Could not destroy purchase: ", this, err);
  					this.auxStatus = 'error';
  					reject(err);
  				}
  			);
  		}
  	});
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
		    purchases: Purchase._arrayExistsParams(purchases)
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
		        resolve(Purchase.fromJsonArray(objs));
		      }, (tagError: any) => {
		      	console.log("Purchase->Could not load tags suggestions: ", tagError);
		      	resolve(Purchase.fromJsonArray(objs));
		      });
		    },
		    (err: any) => {
		      alert("Erro ao buscar boletos existentes");
		      console.error(err);
		    }
		  );
		});
  }
	public static loadReferrals(api: ApiService): Promise<string[]> {
		return new Promise((resolve, reject) => {
			api.show('purchases', 'referrals').subscribe(
				(res: string[]) => {
					resolve(res);
				},
				(err: any) => {
					console.error("Purchase->Could not load referrals: ", err);
				}
			);
		})
	}
	public static getTags(purchases: Purchase[]): Tag[] {
		let res: Tag[] = [];

		for(let pur of purchases) {
			if(!pur.tags)
				continue;

			for(let tag of pur.tags) {
				let aux: Tag = new Tag(tag);
				Utils.pushIfNotExists(res, aux, 'name');
			}
		}

		return res;
	}
	public static getTotal(purchases: Purchase[]): number {
		let total = 0;
		for(let pur of purchases) {
			if(!pur.hidden)
				total += Number(pur.total);
		}

		return Number(total.toFixed(2));
	}

	public static groupByTags(purchases: Purchase[]): {[tagName: string]: Purchase[]} {
		let aux: any = {};
		for(let purchase of purchases) {
			for(let tag of purchase.tags) {
				if(!aux[tag.name])
					aux[tag.name] = [];
				aux[tag.name].push(purchase);
			}
		}
		/* now our 'aux' looks like this:
		 * {
		 * 		'tag 1': [<purchase 1>, <purchase 5>],
		 * 		'tag 2': [<purchase 5>, <purchase 6>, <purchase 20>],
		 * 		'tag 3': [<purchase 20>, <purchase 21>, <purchase 22>, <purchase 23>]
		 * }
		 * now we get the most used tags
		*/
		let mostUsed: string[] = [];
		let aux2: any = [];
		for(let key in aux) {
			aux2.push([aux[key].length, key]);
		}
		aux2.sort((a: any, b: any) => b[0] - a[0]);
		for(let el of aux2) {
			mostUsed.push(el[1]);
		}

		/* most used tags would now be: ['tag 3', 'tag 2', 'tag 1']
		 * now, we remove duplicated purchases. most used tags absorb least used tags
		 * final result should be:
		 * {
		 * 		'tag 3': [<purchase 20>, <purchase 21>, <purchase 22>, <purchase 23>],
		 * 		'tag 2': [<purchase 5>, <purchase 6>],
		 * 		'tag 1': [<purchase 1>]
		 * }
		 */
		let seen: Purchase[] = [];
		let res: {[tagName: string]: Purchase[]} = {};
		for(let tagName of mostUsed) {
			for(let purchase of purchases) {
				if(seen.indexOf(purchase) > -1)
					continue;

				if(Utils.findById(tagName, purchase.tags, 'name')) {
					if(!res[tagName])
						res[tagName] = [purchase];
					else
						res[tagName].push(purchase);

					seen.push(purchase);
				}
			}
		}
		return res;
	}


	//////////// PRIVATE METHODS ////////////////
	private _existsParams() {
		return {
			purchase_date: this.purchase_date,
			supplier_name: this.supplier_name,
			base_value: this.base_value,
			total: this.total
		};
	}
	private static _arrayExistsParams(purchases: Purchase[]) {
		let arr = [];
		for(let obj of purchases) {
			arr.push(obj._existsParams());
		}
		return arr;
	}
}