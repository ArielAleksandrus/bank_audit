import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbCalendar, NgbDatepickerModule, NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';


import { ApiService } from '../shared/services/api.service';
import { QueryHelpers } from '../shared/helpers/query-helpers';
import { StringHelpers } from '../shared/helpers/string-helpers';
import { Utils } from '../shared/helpers/utils';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';
import { Supplier } from '../shared/models/supplier';
import { Tag } from '../shared/models/tag';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

@Component({
  selector: 'app-insertion',
  imports: [CommonModule, FormsModule, NgbDatepickerModule, NgSelectModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './insertion.component.html',
  styleUrl: './insertion.component.scss'
})
export class InsertionComponent {
  company: Company;
  today = inject(NgbCalendar).getToday();

  fromDate: NgbDate | null = null;

  referrals: string[] = [];
  suppliers: Supplier[] = [];
  availableTags: Tag[] = [];
  banks: string[] = [
    'banco do brasil',
    'bradesco',
    'c6',
    'caixa',
    'inter',
    'itaú',
    'nubank',
    'pagseguro',
    'santander',
    'sicoob',
    'sicredi',
    'outro'
  ];

  insertType: 'purchase'|'income' = 'purchase';
  selectedBank: string = '';
  hasReferral: boolean = false;

  purchase: Purchase;
  
  income: Income;

  constructor(private api: ApiService) {
    this.purchase = new Purchase({value: ''});
    this.income = new Income({aux_tags: []});

    this.company = Company.loadCompany();
    if(!this.company) {
      location.href = "/login";
      return;
    }
    api.setAuth({token: this.company.token});

    this.fromDate = this.today;
  }

  ngOnInit() {
    this.loadSuppliers();
    this.loadReferrals();
    this.loadTags();
  }

  loadSuppliers() {
    this.api.indexAll('suppliers').subscribe(
      (res: Supplier[]) => {
        this.suppliers = res;
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
      (res: Tag[]) => {
        this.availableTags = res;
      }
    );
  }

  changedNgSelectObj(obj: Supplier) {
    if(!obj)
      obj = <Supplier>{name: '', cnpj: ''};

    this.purchase.supplier_name = obj.name;
    this.purchase.supplier_cnpj = obj.cnpj;
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
    if(!this.fromDate || !this.purchase.supplier_name || !this.purchase.bank_name || !this.purchase.base_value || !this.purchase.payment_type){
      alert("Campos faltando! Verifique se você selecionou a data no calendário, o fornecedor, o banco de onde o dinheiro saiu, o valor do pagamento e o tipo de pagamento");
      return;
    }

    this.purchase.purchase_date = `${this.fromDate.year}-${this.fromDate.month}-${this.fromDate.day}`

    let boletos = Utils.clone(this.purchase.boletos);
    this.api.create('purchases', { 
      purchase: this.purchase
    }).subscribe(
      (res: Purchase) => {
        this.purchase.id = res.id;
        if(boletos && boletos.length > 0) {
          this._sendBoletos(boletos).then( res2 => {
            alert("Compra enviada!");
            location.reload();
          });
        }
      },
      (err: any) => {
        alert("Erro ao enviar compra!");
        console.error("Erro da compra: ", this.purchase);
      }
    );
  }
  sendIncome() {
    if(!this.fromDate || !this.income.origin || !this.income.bank_name || !this.income.income_type || !this.income.value){
      alert("Campos faltando! Verifique se você selecionou a data no calendário, a origem (quem pagou), o banco para onde o dinheiro foi enviado, o valor do pagamento e o tipo de pagamento");
      return;
    }

    this.api.create('incomes', { income: this.income }).subscribe(
      (res: Income) => {
        alert("Recebimento enviado!");
        location.reload();
      },
      (err: any) => {
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
    if(!this.fromDate || !(this.purchase.installments > 0))
      return;

    let fromStr = `${this.fromDate.day}/${this.fromDate.month}/${this.fromDate.year}`;
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
}