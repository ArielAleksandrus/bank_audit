import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ChartModule } from 'primeng/chart';

import { ApiService } from '../shared/services/api.service';
import { QueryHelpers } from '../shared/helpers/query-helpers';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';
import { Supplier } from '../shared/models/supplier';

import { Reports } from '../shared/parsers/reports';

import { Utils } from '../shared/helpers/utils';

@Component({
  selector: 'app-report',
  imports: [CommonModule, ChartModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.scss'
})
export class ReportComponent {
  company: Company;

  boletos: Boleto[] = [];
  incomes: Income[] = [];
  purchases: Purchase[] = [];
  suppliers: Supplier[] = [];

  from: string;
  to: string;

  fromPtbr: string;
  toPtbr?: string;

  reports: Reports;

  selection: 'none'|'incomes'|'purchases'|'boletos' = 'none';

  constructor(private api: ApiService,
              private router: Router,
              private route: ActivatedRoute) {

    const snapshot = this.route.snapshot;

    this.from = snapshot.queryParams['desde'];
    this.fromPtbr = (Utils.dateToString(this.from, false) || '01/01/0001').split(" ")[0];
    this.to = snapshot.queryParams['ate'];
    if(this.to)
      this.toPtbr = (Utils.dateToString(this.to, false) || "").split(" ")[0];

    this.reports = new Reports();

    this.company = Company.loadCompany();
    if(!this.company) {
      this.router.navigate(['/login']);
      return;
    }
    api.setAuth({token: this.company.token});
  }

  ngOnInit() {
    this.queryEntries();
  }

  queryEntries() {
    this.boletoQuery();
    this.incomeQuery();
    this.purchaseQuery();
  }
  boletoQuery() {
    let params: any = {
      q: {
        "payment_date": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("payment_date", this.from, this.to);
    }

    this.api.indexAll('boletos', params).subscribe(
      (res: {boletos: Boleto[]}) => {
        this.boletos = Boleto.fromJsonArray(res.boletos);
        let tagReport = this.reports.boletoTagChart(this.boletos);
        console.log(tagReport);
      }
    );
  }
  incomeQuery() {
    let params: any = {
      q: {
        "date_received": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("date_received", this.from, this.to);
    }
    
    this.api.indexAll('incomes', params).subscribe(
      (res: {incomes: Income[]}) => {
        this.incomes = Income.fromJsonArray(res.incomes);
      }
    );
  }
  purchaseQuery() {
    let params: any = {
      q: {
        "purchase_date": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("purchase_date", this.from, this.to);
    }
    
    this.api.indexAll('purchases', params).subscribe(
      (res: {purchases: Purchase[]}) => {
        this.purchases = Purchase.fromJsonArray(res.purchases);
      }
    );
  }
}
