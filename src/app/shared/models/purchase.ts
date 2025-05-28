import { Boleto } from './boleto';
import { Tag } from './tag';
export class Purchase {
	id: number;
	company_id: number;
	supplier_id: number;

	bank_name: string;

	base_value: string|number;
	delivery_fee: string|number;
	total: string|number;

	purchase_date: string;

	created_at: string;
	updated_at: string;

	boletos: Boleto[];
	tags: Tag[];

	// set up by our front end app
	supplier_name: string;
	supplier_cnpj: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.company_id = jsonData.company_id;
		this.supplier_id = jsonData.supplier_id;
		this.supplier_name = jsonData.supplier_name;
		this.supplier_cnpj = jsonData.supplier_cnpj;
		this.bank_name = jsonData.bank_name;
		this.base_value = jsonData.base_value;
		this.delivery_fee = jsonData.delivery_fee;
		this.total = jsonData.total;
		this.purchase_date = jsonData.purchase_date;
		this.boletos = jsonData.boletos;
		this.tags = jsonData.tags;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}

	existsParams() {
		return {
			purchase_date: this.purchase_date,
			supplier_name: this.supplier_name,
			base_value: this.base_value,
			total: this.total
		};
	}

	public static arrayExistsParams(purchases: Purchase[]) {
		let arr = [];
		for(let obj of purchases) {
			arr.push(obj.existsParams());
		}
		return arr;
	}
}