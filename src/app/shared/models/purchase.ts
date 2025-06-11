import { Boleto } from './boleto';
import { Tag } from './tag';
import { Utils } from '../helpers/utils';
export type PAYMENT_TYPES = 'cash'|'boleto'|'check'|'credit_card'|'debit_card'|'pix'|'transfer'|'other';
export class Purchase {
	id: number;
	company_id: number;
	supplier_id: number;

	bank_name: string;
	payment_type: PAYMENT_TYPES;
	referral: string;

	base_value: string|number;
	delivery_fee: string|number;
	total: string|number;
	installments: number; // the number of installments (defaults to 1)

	purchase_date: string;

	additional_info: string;

	created_at: string;
	updated_at: string;

	boletos: Boleto[];
	tags: Tag[];
	aux_tags: {id: number, name: string}[];

	// set up by our front end app
	supplier_name: string;
	supplier_cnpj: string;
	paymentTypePtbr: string = '?';
	tagsStr: string;

	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.company_id = jsonData.company_id;
		this.supplier_id = jsonData.supplier_id;
		this.supplier_name = jsonData.supplier_name;
		this.supplier_cnpj = jsonData.supplier_cnpj;
		this.bank_name = jsonData.bank_name;
		this.payment_type = jsonData.payment_type;
		this.installments = jsonData.installments || 1;
		this.referral = jsonData.referral;
		this.base_value = jsonData.base_value;
		this.delivery_fee = jsonData.delivery_fee;
		this.total = jsonData.total;
		this.purchase_date = jsonData.purchase_date;
		this.boletos = jsonData.boletos;
		this.tags = jsonData.tags;
		this.aux_tags = jsonData.aux_tags;
		this.additional_info = jsonData.additional_info;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;

		this.tagsStr = "";
		for(let tag of (this.tags || [])) {
			this.tagsStr += tag.name + ", "
		}
		if(this.tagsStr.length > 2) {
			this.tagsStr = this.tagsStr.split("").splice(0, this.tagsStr.length - 2).join("");
		}
		this.setPaymentTypePtbr();
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Purchase(data));
		}
		return res;
	}

	existsParams() {
		return {
			purchase_date: this.purchase_date,
			supplier_name: this.supplier_name,
			base_value: this.base_value,
			total: this.total
		};
	}
	setPaymentTypePtbr() {
		if(!this.payment_type)
			this.paymentTypePtbr = '-';

		switch(this.payment_type) {
			case("boleto"): {
				this.paymentTypePtbr = "boleto";
				break;
			}
			case("cash"): {
				this.paymentTypePtbr = "dinheiro";
				break;
			}
			case("check"): {
				this.paymentTypePtbr = "cheque";
				break;
			}
			case("credit_card"): {
				this.paymentTypePtbr = "crédito";
				break;
			}
			case("debit_card"): {
				this.paymentTypePtbr = "débito";
				break;
			}
			case("pix"): {
				this.paymentTypePtbr = "pix";
				break;
			}
			case("transfer"): {
				this.paymentTypePtbr = "transferência";
				break;
			}
			case("other"): {
				this.paymentTypePtbr = "outro";
				break;
			}
			default: {
				this.paymentTypePtbr = '?';
				break;
			}
		}
	}
	public static getSupplierNames(purchases: Purchase[]): string[] {
		let arr: string[] = [];

		for(let purchase of purchases) {
			Utils.pushIfNotExists(arr, purchase.supplier_name);
		}

		return arr;
	}
	public static arrayExistsParams(purchases: Purchase[]) {
		let arr = [];
		for(let obj of purchases) {
			arr.push(obj.existsParams());
		}
		return arr;
	}
	public static fromBoleto(boleto: Boleto) {
		const today = (Utils.dateToISO(new Date()) || "1900-01-01 00:00:00").split(" ")[0];

		return new Purchase({
			supplier_name: boleto.supplier_name,
			supplier_cnpj: boleto.supplier_cnpj,
			bank_name: boleto.bank_name,
			payment_type: "boleto",
			installments: 1,
			purchase_date: boleto.issue_date || boleto.payment_date || boleto.expiration_date || today,
			base_value: boleto.value,
			aux_tags: boleto.auxTags
		});
	}
}