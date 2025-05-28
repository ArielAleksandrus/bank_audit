export class Income {
	id: number;
	company_id: number;

	income_type: 'cartao'|'pix'|'outros';
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

	public static arrayExistsParams(incomes: Income[]) {
		let arr = [];
		for(let obj of incomes) {
			arr.push(obj.existsParams());
		}
		return arr;
	}
}