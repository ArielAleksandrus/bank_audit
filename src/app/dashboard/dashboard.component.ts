import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

import { ApiService } from '../shared/services/api.service';
import { DateRangePickerComponent } from '../shared/components/date-range-picker/date-range-picker.component';

import { Company } from '../shared/models/company';
import { User } from '../shared/models/user';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, NgSelectModule, DateRangePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  company: Company;
  companySlug: string;

  curAction: 'init'|'query'|'insert' = 'init';


  constructor(private api: ApiService,
              private router: Router,
              private route: ActivatedRoute) {
    // companyGuard has already validated the slug and set the auth headers.
    this.company = Company.loadCompany();
    this.companySlug = this.route.snapshot.paramMap.get('companySlug')!;
  }

  goToCompanies() {
    this.router.navigate(['/companies']);
  }

  logout() {
    User.clearUser();
    Company.clearCompany();
    this.api.noAuth();
    this.router.navigate(['/login']);
  }

  resetAction() {
    this.curAction = 'init';
  }
  insertAction() {
    this.router.navigate(['/', this.companySlug, 'inserir']);
  }
  uploadAction() {
    this.router.navigate(['/', this.companySlug, 'parser']);
  }

  onDateRangeConfirm(range: { from: string, to: string | null }) {
    let params: any = { desde: range.from };
    if(range.to)
      params.ate = range.to;

    this.router.navigate(['/', this.companySlug, 'relatorio'], {
      queryParams: params
    });
  }
}
