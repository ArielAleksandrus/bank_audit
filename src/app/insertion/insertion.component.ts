import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faArrowTrendDown,
  faArrowTrendUp
} from '@fortawesome/free-solid-svg-icons';

import { ApiService } from '../shared/services/api.service';
import { StringHelpers } from '../shared/helpers/string-helpers';
import { Utils } from '../shared/helpers/utils';
import { Filters } from '../shared/helpers/filters';
import { Constants } from '../shared/helpers/constants';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';
import { Supplier } from '../shared/models/supplier';
import { Tag } from '../shared/models/tag';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { RecentInsertionsComponent } from './recent-insertions/recent-insertions.component';

@Component({
  selector: 'app-insertion',
  imports: [CommonModule, FormsModule, NgSelectModule, NgxMaskDirective, FaIconComponent, RecentInsertionsComponent],
  providers: [provideNgxMask()],
  templateUrl: './insertion.component.html',
  styleUrl: './insertion.component.scss'
})
export class InsertionComponent {
  company: Company;

  dateIso: string;
  todayIso: string;

  referrals: string[] = [];
  suppliers: Supplier[] = [];
  availableTags: Tag[] = [];
  banks: string[] = [...Constants.defaultBanks];

  insertType: 'purchase'|'income' = 'purchase';
  selectedBank: string = '';
  hasReferral: boolean = false;
  sending: boolean = false;

  backIcon = faArrowLeft;
  purchaseIcon = faArrowTrendDown;
  incomeIcon = faArrowTrendUp;

  purchase: Purchase;
  income: Income;

  constructor(private api: ApiService) {
    this.purchase = new Purchase({boletos: []});
    this.income = new Income({aux_tags: []});

    // companyGuard has already validated the company and set the auth headers.
    this.company = Company.loadCompany();

    this.todayIso = this._toIso(new Date());
    this.dateIso = this.todayIso;
  }

  ngOnInit() {
    this.loadSuppliers();
    this.loadReferrals();
    this.loadTags();
    this.loadBanks();
  }

  loadSuppliers() {
    this.api.indexAll('suppliers').subscribe(
      (res: {suppliers: Supplier[]}) => {
        this.suppliers = res.suppliers;
      }
    );
  }
  loadReferrals() {
    this.api.index('purchases', {}, {collection: 'referrals'}).subscribe(
      (res: string[]) => {
        this.referrals = res;
      }
    );
  }
  loadTags() {
    this.availableTags = [];
    this.api.indexAll('tags').subscribe(
      (res: {tags: Tag[]}) => {
        this.availableTags = res.tags;
      }
    );
  }
  loadBanks() {
    Purchase.loadBanks(this.api).then((customBanks: string[]) => {
      this.banks = this.mergeBanks(Constants.defaultBanks, customBanks);
    });
  }
  addBankTag = (term: string) => {
    const name = (term || '').trim();
    return name || false;
  }
  bankChanged(name: string) {
    if(name)
      this.banks = this.mergeBanks(this.banks, [name]);
  }

  changedNgSelectObj(obj: Supplier) {
    if(!obj)
      obj = <Supplier>{name: '', cnpj: ''};

    this.purchase.supplier_name = obj.name;
    this.purchase.supplier_cnpj = obj.cnpj;
  }

  toggleReferral() {
    this.hasReferral = !this.hasReferral;
    if(!this.hasReferral)
      this.purchase.referral = '';
  }

  back() {
    history.back();
  }

  paymentTypeChanged() {
    switch(this.purchase.payment_type) {
    case("boleto"): {
      this._genBoletos();
      break;
    }
    }
  }

  sendPurchase() {
    if(this.sending)
      return;
    if(!this.dateIso || !this.purchase.supplier_name || !this.purchase.bank_name || !this.purchase.base_value || !this.purchase.payment_type){
      alert("Campos faltando! Verifique se você selecionou a data, o fornecedor, o banco de onde o dinheiro saiu, o valor do pagamento e o tipo de pagamento");
      return;
    }

    this.purchase.purchase_date = this.dateIso;

    let boletos = Utils.clone(this.purchase.boletos);
    this.sending = true;
    this.api.create('purchases', {
      purchase: this.purchase
    }).subscribe(
      (res: Purchase) => {
        this.purchase.id = res.id;
        const done = () => {
          this.sending = false;
          alert("Compra enviada!");
          location.reload();
        };
        if(boletos && boletos.length > 0) {
          this._sendBoletos(boletos).then(done).catch(() => {
            this.sending = false;
          });
        } else {
          done();
        }
      },
      (err: any) => {
        this.sending = false;
        alert("Erro ao enviar compra!");
        console.error("Erro da compra: ", this.purchase);
      }
    );
  }
  sendIncome() {
    if(this.sending)
      return;
    if(!this.dateIso || !this.income.origin || !this.income.bank_name || !this.income.income_type || !this.income.value){
      alert("Campos faltando! Verifique se você selecionou a data, a origem (quem pagou), o banco para onde o dinheiro foi enviado, o valor do pagamento e o tipo de pagamento");
      return;
    }

    this.income.date_received = this.dateIso;
    this.sending = true;
    this.api.create('incomes', { income: this.income }).subscribe(
      (res: Income) => {
        this.sending = false;
        alert("Recebimento enviado!");
        location.reload();
      },
      (err: any) => {
        this.sending = false;
        alert("Erro ao enviar recebimento!");
        console.error("Erro do recebimento: ", this.income);
      }
    );
  }

  private _sendBoletos(boletos: Boleto[], idx: number = 0) {
    return new Promise((resolve, reject) => {
      let boleto = boletos[idx];
      if(boleto == null) {
        resolve(true);
        return;
      }
      // treat attrs to be ready to send
      boleto.purchase_id = this.purchase.id;
      boleto.expiration_date = StringHelpers.maskedPtbrDateToISO(boleto.expiration_date);

      this.api.create('boletos', { boleto }).subscribe(
        (res: Boleto) => {
          resolve(this._sendBoletos(boletos, idx + 1));
        },
        (err: any) => {
          alert("Erro ao enviar o boleto #" + idx);
          console.error("Erro do boleto: ", boleto);
          reject(err);
        }
      );
    })
  }

  private _genBoletos() {
    if(!this.dateIso || !(this.purchase.installments > 0))
      return;

    let fromStr = this._isoToPtbr(this.dateIso);
    this.purchase.boletos = [];
    for(let i = 0; i < this.purchase.installments; i++) {
      this.purchase.boletos.push(new Boleto({
        bank_name: this.purchase.bank_name,
        value: ((Number(this.purchase.base_value) || 0) / (this.purchase.installments || 1)).toFixed(2),
        installments: `${i+1}de${this.purchase.installments}`,
        expiration_date: '',
        issue_date: fromStr
      }));
    }
  }

  private mergeBanks(...lists: string[][]): string[] {
    const merged: string[] = [];
    const seen: {[key: string]: boolean} = {};
    for(let list of lists) {
      for(let name of (list || [])) {
        const trimmed = (name || '').trim();
        const key = StringHelpers.removeAccent(trimmed.toLowerCase());
        if(!trimmed || seen[key])
          continue;
        seen[key] = true;
        Utils.pushIfNotExists(merged, trimmed);
      }
    }
    return Filters.orderAlphabetically(merged);
  }

  private _toIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private _isoToPtbr(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }
}
