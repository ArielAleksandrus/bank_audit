export class Company {
	id: number;
	name: string;
	token: string;

	created_at: string;
	updated_at: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.name = jsonData.name;
		this.token = jsonData.token;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}

	public static storeCompany(comp: Company) {
		localStorage.setItem('current_company', JSON.stringify({company: comp}));
	}
	public static loadCompany() {
		const defaultCompany = JSON.stringify({company: null});
		return JSON.parse(localStorage.getItem('current_company') || defaultCompany).company;
	}
}