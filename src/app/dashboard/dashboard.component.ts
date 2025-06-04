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

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, NgbDatepickerModule, NgSelectModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  company: Company;
  today = inject(NgbCalendar).getToday();
  hoveredDate: NgbDate | null = null;

  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;

  boletos: Boleto[] = [];
  incomes: Income[] = [];
  purchases: Purchase[] = [];
  suppliers: Supplier[] = [];

  curAction: 'init'|'query'|'insert' = 'init';


  constructor(private api: ApiService) {
    this.company = Company.loadCompany();
    if(!this.company) {
      location.href = "/login";
      return;
    }
    api.setAuth({token: this.company.token});
  }

  resetAction() {
    this.fromDate = this.toDate = this.hoveredDate = null;
    this.boletos = [];
    this.incomes = [];
    this.purchases = [];
    this.curAction = 'init';
  }
  insertAction() {
    location.href = "/inserir";
  }

  queryEntries() {
    let fromStr = this.ngbDateToISO(this.fromDate);
    let toStr = this.ngbDateToISO(this.toDate);
    if(!fromStr)
      return;

    this.boletos = [];
    this.incomes = [];
    this.purchases = [];
    this.boletoQuery(fromStr, toStr);
    this.incomeQuery(fromStr, toStr);
    this.purchaseQuery(fromStr, toStr);
  }

  boletoQuery(fromStr: string, toStr: string | null) {
    let params: any = {
      q: {
        "payment_date": fromStr
      }
    };
    if(toStr) {
      params = QueryHelpers.queryIntervalParams("payment_date", fromStr, toStr);
    }

    this.api.indexAll('boletos', params).subscribe(
      (res: Boleto[]) => {
        this.boletos = Boleto.fromJsonArray(res);
      }
    );
  }
  incomeQuery(fromStr: string, toStr: string | null) {
    let params: any = {
      q: {
        "date_received": fromStr
      }
    };
    if(toStr) {
      params = QueryHelpers.queryIntervalParams("date_received", fromStr, toStr);
    }
    
    this.api.indexAll('incomes', params).subscribe(
      (res: Income[]) => {
        this.incomes = Income.fromJsonArray(res);
      }
    );
  }
  purchaseQuery(fromStr: string, toStr: string | null) {
    let params: any = {
      q: {
        "purchase_date": fromStr
      }
    };
    if(toStr) {
      params = QueryHelpers.queryIntervalParams("purchase_date", fromStr, toStr);
    }
    
    this.api.indexAll('purchases', params).subscribe(
      (res: Purchase[]) => {
        this.purchases = Purchase.fromJsonArray(res);
      }
    );
  }

  ngbDateToISO(date: NgbDate|null): string|null {
    if(!date)
      return null;

    let monthStr = String(date.month);
    if(date.month < 10)
      monthStr = "0" + monthStr;

    let dayStr = String(date.day);
    if(date.day < 10)
      dayStr = "0" + dayStr;

    return `${date.year}-${monthStr}-${dayStr}`;
  }

  onDateSelection(date: NgbDate) {
    if(!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if(this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
  }
  isHovered(date: NgbDate) {
    return (
      this.fromDate && !this.toDate && this.hoveredDate && date.after(this.fromDate) && date.before(this.hoveredDate)
    );
  }

  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate) && date.before(this.toDate);
  }

  isRange(date: NgbDate) {
    return (
      date.equals(this.fromDate) ||
      (this.toDate && date.equals(this.toDate)) ||
      this.isInside(date) ||
      this.isHovered(date)
    );
  }

}
