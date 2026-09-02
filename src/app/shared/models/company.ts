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

	get slug(): string {
		return Company.slugify(this.name);
	}

	public static slugify(name: string): string {
		return (name || '')
			.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	public static fromJsonArray(jsonArr: any[]): Company[] {
		return (jsonArr || []).map(data => new Company(data));
	}

	public static storeCompany(comp: Company) {
		localStorage.setItem('current_company', JSON.stringify({company: comp}));
	}
	public static loadCompany() {
		const defaultCompany = JSON.stringify({company: null});
		return JSON.parse(localStorage.getItem('current_company') || defaultCompany).company;
	}
	public static clearCompany() {
		localStorage.removeItem('current_company');
	}

	// The set of companies picked on the companies page to view a combined
	// report for (distinct from the single "current_company" used elsewhere).
	// isAll marks that every company the user has was picked (e.g. via
	// "Todas as Empresas"), so the report can just say "Todas as Empresas"
	// instead of spelling out every name.
	public static storeSelectedCompanies(companies: Company[], isAll: boolean = false) {
		localStorage.setItem('selected_companies', JSON.stringify({companies: companies, all: isAll}));
	}
	public static loadSelectedCompanies(): Company[] {
		const empty = JSON.stringify({companies: [], all: false});
		const companies = JSON.parse(localStorage.getItem('selected_companies') || empty).companies;
		return Company.fromJsonArray(companies);
	}
	public static loadSelectedCompaniesAreAll(): boolean {
		const empty = JSON.stringify({companies: [], all: false});
		return !!JSON.parse(localStorage.getItem('selected_companies') || empty).all;
	}
	public static clearSelectedCompanies() {
		localStorage.removeItem('selected_companies');
	}
}
