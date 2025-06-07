import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbCalendar, NgbDatepickerModule, NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';


import { ApiService } from '../shared/services/api.service';
import { QueryHelpers } from '../shared/helpers/query-helpers';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';
import { Supplier } from '../shared/models/supplier';
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
  boletos: Boleto[] = [];
  
  income: Income;

  constructor(private api: ApiService) {
    this.purchase = new Purchase({
      installments: 1
    });
    this.income = new Income({});

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

  send() {

  }

  private _genBoletos() {
    if(!this.fromDate || !(this.purchase.installments > 0))
      return;

    let fromStr = `${this.fromDate.day}/${this.fromDate.month}/${this.fromDate.year}`;
    this.boletos = [];
    for(let i = 0; i < this.purchase.installments; i++) {
      this.boletos.push(new Boleto({
        bank_name: this.selectedBank,
        value: ((Number(this.purchase.base_value) || 0) / (this.purchase.installments || 1)).toFixed(2),
        installments: `${i+1}de${this.purchase.installments}`,
        expiration_date: '',
        issue_date: fromStr
      }));
    }
  }
}