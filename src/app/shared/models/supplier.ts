import { ApiService } from '../services/api.service';
import { Filters } from '../helpers/filters';

export class Supplier {
	id: number;
	name: string;
	cnpj: string;

	created_at: string;
	updated_at: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.name = jsonData.name;
		this.cnpj = jsonData.cnpj;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}
	public static fromJsonArray(jsonArr: any[]): Supplier[] {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Supplier(data));
		}
		return res;
	}

	public static loadSuppliers(api: ApiService): Promise<Supplier[]> {
    return new Promise((resolve, reject) => {
      api.indexAll('suppliers').subscribe(
        (res: any) => {
          res.suppliers = Filters.orderAlphabetically(res.suppliers, 'name', false);
          resolve(res.suppliers);
        },
        (err: any) => {
          console.error("Supplier->Failed to load suppliers: ", err);
          reject(err);
        }
      );
    });
	}
}