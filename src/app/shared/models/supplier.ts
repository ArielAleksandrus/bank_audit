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
}