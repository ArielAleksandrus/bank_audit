import { Purchase, Tag } from './index';
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

		this.tagsStr = "";
		for(let tag of (this.auxTags || [])) {
			this.tagsStr += tag.name + ", "
		}
		if(this.tagsStr.length > 2) {
			this.tagsStr = this.tagsStr.split("").splice(0, this.tagsStr.length - 2).join("");
		}
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Boleto(data));
		}
		return res;
	}

  public static sendArray(api: ApiService, boletos: Boleto[]): Promise<Boleto[]> {
  	return Boleto._auxSendArray(api, boletos);
  }
  send(api: ApiService): Promise<Boleto> {
    return new Promise((resolve, reject) => {
    	// if purchase_id is invalid, we have to create a purchase first.
    	if(!(this.purchase_id > 0)) {
    		let pur: Purchase = Purchase.fromBoleto(this);
    		// I had two boletos of Anapool, of the same value, payed at the same time
        // 1 of them was connected to my restaurant, and the other to the pizza restaurant
        // therefore, when creating boletos, we have to disable Purchase's anti-duplicate check
    		pur.send(api, false).then((purchase: Purchase) => {
    			this.purchase_id = purchase.id;
    			if(this.purchase_id > 0) {
    				resolve(this.send(api));
    			} else {
    				console.error("Boleto->Could not save purchase beforehand: ", purchase, this);
    				reject(purchase);
    			}
    		}).catch((err: any) => {
    			console.error("Boleto->Error saving purchase beforehand: ", err, this);
    			reject(err);
    		});

    		return;
    	}

      let req: any = null;
      if(this.id > 0) {
        req = api.update('boletos', this.id, {boleto: this});
      } else {
        req = api.create('boletos', {boleto: this});
      }

      req.subscribe(
        (res: Boleto) => {
          resolve(new Boleto(res));
        },
        (err: any) => {
          console.error("Boleto->Could not save boleto: ", this, err);
          reject(err);
        }
      );
    })
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

	public static arrayExists(api: ApiService, boletos: Boleto[]): Promise<Boleto[]> {
		let objs: Boleto[] = Utils.clone(boletos);
		
		return new Promise((resolve, reject) => {
		  let params = {
		    boletos: Boleto._arrayExistsParams(boletos)
		  }

		  api.req('boletos', params, {collection: 'exists'}, 'post').subscribe(
		    (res: {boletos: Boleto[]}) => {
		      for(let i = 0; i < objs.length; i++) {
		        if(res.boletos[i] && res.boletos[i].id > 0) {
		          objs[i] = new Boleto(res.boletos[i]);
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

  private static _auxSendArray(api: ApiService, boletos: Boleto[], idx: number = 0): Promise<Boleto[]> {
  	return new Promise((resolve, reject) => {
  		if(idx >= boletos.length) {
  			resolve(Boleto.fromJsonArray(boletos));
  			return;
  		}
  		let boleto = boletos[idx];
  		boleto.send(api).then(res => {
  			boletos[idx] = res;
  			resolve(Boleto._auxSendArray(api, boletos, idx + 1));
  		})
  	});
  }
	private static _arrayExistsParams(boletos: Boleto[]) {
		let arr = [];
		for(let obj of boletos) {
			arr.push(obj._existsParams());
		}
		return arr;
	}
}