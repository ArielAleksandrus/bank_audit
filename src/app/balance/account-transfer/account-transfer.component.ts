import { Component, model } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AccountTransfer } from '../../shared/models/account-transfer';
import { PAYMENT_TRANSLATION } from '../../shared/models/purchase';
import { ApiService } from '../../shared/services/api.service';

const INCOME_TYPE_OPTIONS: {value: string, label: string}[] = [
	{ value: 'cartao', label: 'Cartão' },
	{ value: 'cheque', label: 'Cheque' },
	{ value: 'deposito', label: 'Depósito' },
	{ value: 'pix', label: 'Pix' },
	{ value: 'transferencia', label: 'Transferência' },
	{ value: 'resgate_investimento', label: 'Resgate de Fundos/Investimento' },
	{ value: 'outros', label: 'Outros' }
];

@Component({
	selector: 'app-account-transfer',
	imports: [CommonModule, FormsModule],
	providers: [DatePipe, CurrencyPipe],
	templateUrl: './account-transfer.component.html',
	styleUrl: './account-transfer.component.scss'
})
export class AccountTransferComponent {
	accountTransfers = model.required<AccountTransfer[]>();

	incomeTypeOptions = INCOME_TYPE_OPTIONS;
	paymentTypeOptions = Object.keys(PAYMENT_TRANSLATION)
		.filter(key => key != 'movimentacao_entre_contas')
		.map(key => ({ value: key, label: PAYMENT_TRANSLATION[key] }));

	// The transfer currently showing its "not actually a transfer" form.
	resolving?: AccountTransfer;
	resolveKind: 'income'|'purchase' = 'income';
	resolveType: string = '';
	resolveError: string = '';

	constructor(private api: ApiService) { }

	get total(): number {
		return AccountTransfer.getTotal(this.accountTransfers());
	}

	openResolve(transfer: AccountTransfer) {
		this.resolving = transfer;
		this.resolveKind = transfer.source_type || 'income';
		this.resolveType = '';
		this.resolveError = '';
	}

	cancelResolve() {
		this.resolving = undefined;
	}

	confirmResolve() {
		const transfer = this.resolving;
		if(!transfer || !this.resolveType || transfer.resolving)
			return;

		transfer.resolving = true;
		transfer.resolve(this.api, this.resolveKind, this.resolveType).then(() => {
			const remaining = this.accountTransfers().filter(t => t.id != transfer.id);
			this.accountTransfers.set(remaining);
			this.resolving = undefined;
		}).catch(err => {
			transfer.resolving = false;
			this.resolveError = 'Não foi possível salvar. Tente novamente.';
			console.error('AccountTransferComponent: could not resolve transfer', err);
		});
	}
}
