import { Boleto } from './boleto';
import { Tag } from './tag';
export type Purchase = {
	id: number;
	company_id: number;
	supplier_id: number;
	supplier_name: string;

	base_value: string|number;
	delivery_fee: string|number;
	total: string|number;

	created_at: string;
	updated_at: string;

	boletos: Boleto[];
	tags: Tag[];
}