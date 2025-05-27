import { Tag } from './tag';
export type Boleto = {
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
}