import { Tag } from './index';
import { Utils } from '../helpers/utils';
import { ApiService } from '../services/api.service';

export class Boleto {
	id: number;
	purchase_id: number;
	supplier_name: string;

	bank_name: string;
	bank_identification: string;
	issue_date: string;
	expiration_date: string;
	payment_date: string;
	value: string|number;
	installments: string; // E.g.: '1de3'
	additional_info: string;

	created_at: string;
	updated_at: string;

	// set by our front end app to help us
	supplier_cnpj: string;
	auxTags: Tag[];
	tagsStr: string;
	auxStatus: 'ok'|'error';
	hidden: boolean;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.purchase_id = jsonData.purchase_id;
		this.supplier_name = jsonData.supplier_name;
		this.bank_name = jsonData.bank_name;
		this.bank_identification = jsonData.bank_identification;
		this.issue_date = jsonData.issue_date;
		this.expiration_date = jsonData.expiration_date;
		this.payment_date = jsonData.payment_date;
		this.value = jsonData.value;
		this.installments = jsonData.installments;
		this.additional_info = jsonData.additional_info;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
		this.supplier_cnpj = jsonData.supplier_cnpj;
		this.auxTags = jsonData.auxTags;
		this.hidden = jsonData.hidden;

		this.tagsStr = "";
		for(let tag of (this.auxTags || [])) {
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
			res.push(new Boleto(data));
		}
		return res;
	}

	setTags(tags: Tag[]) {
		this.auxTags = tags;
	}

  // Sends the whole array in a single request; the server creates/updates
  // each boleto one by one (auto-creating its purchase first when the
  // boleto has no purchase_id yet, same as this used to do client-side)
  // and reports a per-item result back, in order.
  public static sendArray(api: ApiService, boletos: Boleto[]): Promise<Boleto[]> {
  	let objs: Boleto[] = Boleto.fromJsonArray(Utils.clone(boletos));
  	if(objs.length == 0) {
  		return Promise.resolve(objs);
  	}

  	return new Promise((resolve, reject) => {
  		api.req('boletos', {boletos: objs}, {collection: 'batch'}, 'post').subscribe(
  			(res: any[]) => {
  				for(let i = 0; i < objs.length; i++) {
  					let entry = res[i];
  					if(!entry) continue;

  					if(entry.errors) {
  						objs[i].auxStatus = 'error';
  					} else {
  						objs[i] = new Boleto(entry);
  					}
  				}
  				resolve(objs);
  			},
  			(err: any) => {
  				console.error("Boleto->Could not save batch: ", err);
  				objs.forEach(boleto => boleto.auxStatus = 'error');
  				reject(err);
  			}
  		);
  	});
  }
  destroy(api: ApiService): Promise<boolean> {
  	return new Promise((resolve, reject) => {
  		if(this.id > 0) {
  			api.destroy('boletos', this.id).subscribe(
  				(res: any) => {
  					resolve(true);
  				},
  				(err: any) => {
  					console.error("Boleto->Could not destroy boleto: ", this, err);
  					reject(err);
  				}
  			);
  		}
  	});
  }

	isValid(): boolean {
		const hasSupplier = !!this.purchase_id || !!this.supplier_name;
		const hasRequiredAttrs = !!this.bank_name && !!this.payment_date && !!this.value;

		return hasSupplier && hasRequiredAttrs;
	}

	public static hasTag(boleto: Boleto, tags: string[], andOr: 'and'|'or' = 'or'): boolean {
		let found = 0;
		for(let auxTag of boleto.auxTags) {
			if(tags.indexOf(auxTag.name) > -1)
				found += 1;
		}
		if(andOr == 'and') return found == tags.length;
		if(andOr == 'or') return found > 0;

		return false;
	}

	public static arrayExists(api: ApiService, boletos: Boleto[]): Promise<Boleto[]> {
		let objs: Boleto[] = Utils.clone(boletos);
		
		return new Promise((resolve, reject) => {
		  let params = {
		    boletos: Boleto._arrayExistsParams(boletos)
		  }

		  api.req('boletos', params, {collection: 'exists'}, 'post').subscribe(
		    (res: {boletos: Boleto[]}) => {
		      for(let i = 0; i < objs.length; i++) {
		        // Only adopt the id, so Salvar updates the existing row instead
		        // of duplicating it - replacing the whole object would silently
		        // revert any local edit (e.g. a comprovante-matched supplier
		        // name) back to whatever was saved the last time around.
		        if(res.boletos[i] && res.boletos[i].id > 0) {
		          objs[i].id = res.boletos[i].id;
		        }
		      }
		      Tag.loadSuggestions(api, Boleto.getSupplierNames(objs)).then((suggestions: {[supplierName: string]: Tag[]}) => {
		        for(let boleto of objs) {
		          let suggestedTags: Tag[] = suggestions[boleto.supplier_name];
		          if(suggestedTags) {
		            boleto.auxTags = Utils.clone(suggestedTags);
		          }
		        }
		        resolve(Boleto.fromJsonArray(objs));
		      }, (tagError: any) => {
		      	console.log("Boleto->Could not load tags suggestions: ", tagError);
		        resolve(Boleto.fromJsonArray(objs));
		      });
		    },
		    (err: any) => {
		      alert("Erro ao buscar boletos existentes");
		      console.error(err);
		    }
		  );
		});
  }
	public static getSupplierNames(boletos: Boleto[]): string[] {
		let arr: string[] = [];

		for(let boleto of boletos) {
			Utils.pushIfNotExists(arr, boleto.supplier_name);
		}

		return arr;
	}

	public static getTotal(boletos: Boleto[]): number {
		let total = 0;
		for(let obj of boletos) {
			if(!obj.hidden)
				total += Number(obj.value);
		}

		return Number(total.toFixed(2));
	}

	//////////// PRIVATE METHODS ////////////////
  private _existsParams() {
		return {
			bank_name: this.bank_name,
			bank_identification: this.bank_identification,
			expiration_date: this.expiration_date,
			value: this.value,
			supplier_name: this.supplier_name
		};
	}

	private static _arrayExistsParams(boletos: Boleto[]) {
		let arr = [];
		for(let obj of boletos) {
			arr.push(obj._existsParams());
		}
		return arr;
	}
}