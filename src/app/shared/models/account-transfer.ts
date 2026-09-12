import { ApiService } from '../services/api.service';

// Money moved between two of the company's own bank accounts (same
// titularidade) - not an income, not a purchase, doesn't change the
// company's wealth. Created server-side when an Income/Purchase is marked
// with income_type/payment_type "movimentacao_entre_contas" (see
// AccountTransfer::SENTINEL_TYPE on the API); never created directly here.
export class AccountTransfer {
	id: number;
	company_id: number;

	date: string;
	value: string|number;
	party_name: string;
	party_cnpj: string;
	bank_name: string;
	bank_identification: string;
	additional_info: string;
	// which table this was reclassified from - just a hint for the "not
	// actually a transfer" form's default selection.
	source_type: 'income'|'purchase';

	created_at: string;
	updated_at: string;

	// front-end app's aux variables
	hidden: boolean = false;
	resolving: boolean = false;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.company_id = jsonData.company_id;
		this.date = jsonData.date;
		this.value = jsonData.value;
		this.party_name = jsonData.party_name;
		this.party_cnpj = jsonData.party_cnpj;
		this.bank_name = jsonData.bank_name;
		this.bank_identification = jsonData.bank_identification;
		this.additional_info = jsonData.additional_info;
		this.source_type = jsonData.source_type;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}

	public static fromJsonArray(jsonArr: any[]): AccountTransfer[] {
		return (jsonArr || []).map(data => new AccountTransfer(data));
	}

	public static getTotal(transfers: AccountTransfer[]): number {
		let total = 0;
		for(let transfer of transfers) {
			if(!transfer.hidden)
				total += Number(transfer.value);
		}
		return Number(total.toFixed(2));
	}

	// Un-marks this as a transfer: rebuilds it as an income or a purchase
	// with the type the caller picked, and removes the transfer record.
	resolve(api: ApiService, kind: 'income'|'purchase', type: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const params: any = { kind };
			if(kind == 'income')
				params.income_type = type;
			else
				params.payment_type = type;

			api.req('account_transfers', params, { member: { id: this.id, value: 'resolve' } }, 'post').subscribe(
				(res: any) => resolve(res),
				(err: any) => reject(err)
			);
		});
	}
}
