import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { Company } from '../shared/models/company';

import { ApiService } from '../shared/services/api.service';

import { Utils } from '../shared/helpers/utils';
import { Filters } from '../shared/helpers/filters';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  company?: Company;

  companyToken: string = '';

  constructor (private api: ApiService) {
  }

  ngOnInit() {
    this._loadCompany();
  }

  login() {
    this.api.setAuth({token: this.companyToken})
    this.api.show('companies', 'mine').subscribe(
      (res: Company) => {
        this.company = res;
        Company.storeCompany(res);
        location.href = '/dashboard';
      },
      (err: any) => {
        alert("Falha no login. Tente novamente");
        this.api.setAuth({token: null});
        console.error(err);
      }
    );
  }

  private _loadCompany() {
    let loaded = Company.loadCompany();
    if(loaded) {
      this.companyToken = loaded.token;
      this.login();
    }
  }
}
