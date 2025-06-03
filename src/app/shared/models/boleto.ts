import { Tag } from './tag';
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
	}

	existsParams() {
		return {
			bank_name: this.bank_name,
			bank_identification: this.bank_identification,
			expiration_date: this.expiration_date,
			value: this.value,
			supplier_name: this.supplier_name
		};
	}

	isValid(): boolean {
		const hasSupplier = !!this.purchase_id || !!this.supplier_name;
		const hasRequiredAttrs = !!this.bank_name && !!this.payment_date && !!this.value;

		return hasSupplier && hasRequiredAttrs;
	}

	public static arrayExistsParams(boletos: Boleto[]) {
		let arr = [];
		for(let obj of boletos) {
			arr.push(obj.existsParams());
		}
		return arr;
	}

	public static queryParams(attr: 'payment_date', val: any) {
		let params: any = {};

		switch(attr) {
		case("payment_date"): {
			if(Array.isArray(val)) {
				params.q_interval = {
					"payment_date": [`>=${val[0]}`, `<=${val[1]}`]
				}
			} else {
				params.q = {
					"payment_date": val
				}
			}
			break;
		}
		}

		return params;
	}
}