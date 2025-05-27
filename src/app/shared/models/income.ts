export type Income = {
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
}