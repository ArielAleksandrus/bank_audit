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
  selectedSupplier: Supplier = <Supplier>{name: '', cnpj: ''};
  selectedBank: string = '';

  partialValue?: number;
  installmentsQty: number = 1;
  hasBoleto: boolean = false;
  boletos: Boleto[] = [];

  constructor(private api: ApiService) {
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
  }

  loadSuppliers() {
    this.api.indexAll('suppliers').subscribe(
      (res: Supplier[]) => {
        this.suppliers = res;
      }
    );
  }

  changedNgSelectObj(obj: Supplier) {
    this.selectedSupplier = new Supplier(obj);
  }

  back() {
    history.back();
  }

  hasBoletoChanged() {
    if(!this.fromDate)
      return;

    let fromStr = `${this.fromDate.day}/${this.fromDate.month}/${this.fromDate.year}`;
    if(this.hasBoleto) {
      this.boletos = [];
      for(let i = 0; i < this.installmentsQty; i++) {
        this.boletos.push(new Boleto({
          supplier_name: this.selectedSupplier.name,
          supplier_cnpj: this.selectedSupplier.cnpj,
          bank_name: this.selectedBank,
          value: this.partialValue,
          installments: `${i+1}de${this.installmentsQty}`,
          expiration_date: '',
          issue_date: fromStr
        }));
      }
    }
  }

  send() {

  }
}