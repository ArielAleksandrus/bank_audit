import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuildingColumns,
  faCircleCheck,
  faCircleExclamation,
  faEnvelope,
  faLayerGroup,
  faListCheck,
  faPlus,
  faRightToBracket,
  faTrash,
  faUserPlus,
  faUsers
} from '@fortawesome/free-solid-svg-icons';

import { Company, MembershipRole } from '../shared/models/company';
import { Membership } from '../shared/models/membership';
import { User } from '../shared/models/user';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  buyer: 'Comprador'
};

import { ApiService } from '../shared/services/api.service';
import { DateRangePickerComponent } from '../shared/components/date-range-picker/date-range-picker.component';

@Component({
  selector: 'app-company-select',
  imports: [CommonModule, FormsModule, FaIconComponent, DateRangePickerComponent],
  templateUrl: './company-select.component.html',
  styleUrl: './company-select.component.scss'
})
export class CompanySelectComponent {
  user: User;

  companies: Company[] = [];
  loading: boolean = true;
  errorMessage: string = '';

  newCompanyName: string = '';
  creating: boolean = false;

  showAddMember: Record<number, boolean> = {};
  newMemberEmail: Record<number, string> = {};
  newMemberRole: Record<number, 'admin'|'buyer'> = {};
  addingMember: Record<number, boolean> = {};
  addMemberMessage: Record<number, string> = {};
  addMemberStatus: Record<number, 'success' | 'error'> = {};

  showMembers: Record<number, boolean> = {};
  membersLoading: Record<number, boolean> = {};
  members: Record<number, Membership[]> = {};
  removingMember: Record<number, boolean> = {};

  roleLabels = ROLE_LABELS;

  selectedIds: Record<number, boolean> = {};
  // set while the date-range picker is shown, right before going to the
  // combined report for these companies
  pickingReportFor: Company[] | null = null;

  buildingIcon = faBuildingColumns;
  enterIcon = faRightToBracket;
  addUserIcon = faUserPlus;
  plusIcon = faPlus;
  envelopeIcon = faEnvelope;
  alertIcon = faCircleExclamation;
  successIcon = faCircleCheck;
  allCompaniesIcon = faLayerGroup;
  selectedCompaniesIcon = faListCheck;
  membersIcon = faUsers;
  removeIcon = faTrash;

  constructor(private api: ApiService, private router: Router) {
    this.user = User.loadUser();
    if(!this.user || !this.user.token) {
      this.router.navigate(['/login']);
      return;
    }

    this.api.setAuth({ 'User-Token': this.user.token });
  }

  ngOnInit() {
    this._loadCompanies();
  }

  selectCompany(company: Company) {
    Company.storeCompany(company);
    this.router.navigate(['/', company.slug, 'dashboard']);
  }

  toggleSelectCompany(company: Company) {
    this.selectedIds[company.id] = !this.selectedIds[company.id];
  }

  get selectedCompanies(): Company[] {
    return this.companies.filter(c => this.selectedIds[c.id]);
  }

  viewAllCompanies() {
    this.pickingReportFor = this.companies;
  }

  viewSelectedCompanies() {
    if(this.selectedCompanies.length === 0) {
      return;
    }
    this.pickingReportFor = this.selectedCompanies;
  }

  cancelPickReport() {
    this.pickingReportFor = null;
  }

  onDateRangeConfirm(range: { from: string, to: string | null }) {
    if(!this.pickingReportFor) {
      return;
    }

    const isAll = this.pickingReportFor.length === this.companies.length;
    Company.storeSelectedCompanies(this.pickingReportFor, isAll);
    this.pickingReportFor = null;

    let params: any = { desde: range.from };
    if(range.to)
      params.ate = range.to;

    this.router.navigate(['/relatorio-multi'], { queryParams: params });
  }

  toggleAddMember(company: Company) {
    this.showAddMember[company.id] = !this.showAddMember[company.id];
    this.addMemberMessage[company.id] = '';
    this.newMemberEmail[company.id] = '';
    this.newMemberRole[company.id] = 'admin';
  }

  addMember(company: Company) {
    const email = (this.newMemberEmail[company.id] || '').trim();
    if(!email) {
      this.addMemberStatus[company.id] = 'error';
      this.addMemberMessage[company.id] = 'Preencha o e-mail do usuário';
      return;
    }
    const role: 'admin'|'buyer' = this.newMemberRole[company.id] || 'admin';

    this.addMemberMessage[company.id] = '';
    this.addingMember[company.id] = true;

    this._checkUserExists(email).then((exists: boolean) => {
      if(!exists) {
        this.addingMember[company.id] = false;
        this.addMemberStatus[company.id] = 'error';
        this.addMemberMessage[company.id] = 'Não existe usuário cadastrado com este e-mail';
        return;
      }

      const confirmed = confirm(`Usuário encontrado. Deseja adicionar "${email}" a esta empresa como ${this.roleLabels[role]}?`);
      if(!confirmed) {
        this.addingMember[company.id] = false;
        return;
      }

      this.api.create(`companies/${company.id}/members`, {
        membership: { email: email, role: role }
      }).subscribe(
        (res: any) => {
          this.addingMember[company.id] = false;
          this.addMemberStatus[company.id] = 'success';
          this.addMemberMessage[company.id] = `Usuário "${email}" adicionado como ${this.roleLabels[role]}`;
          this.newMemberEmail[company.id] = '';
          if(this.members[company.id]) {
            this.members[company.id] = this.members[company.id].concat(new Membership(res));
          }
        },
        (err: any) => {
          this.addingMember[company.id] = false;
          this.addMemberStatus[company.id] = 'error';
          this.addMemberMessage[company.id] = this._addMemberErrorMessage(err);
          console.error(err);
        }
      );
    }, (err: any) => {
      this.addingMember[company.id] = false;
      this.addMemberStatus[company.id] = 'error';
      this.addMemberMessage[company.id] = 'Não foi possível verificar o e-mail. Tente novamente';
      console.error(err);
    });
  }

  toggleMembers(company: Company) {
    this.showMembers[company.id] = !this.showMembers[company.id];
    if(this.showMembers[company.id] && !this.members[company.id]) {
      this.loadMembers(company);
    }
  }

  loadMembers(company: Company) {
    this.membersLoading[company.id] = true;
    this.api.index(`companies/${company.id}/members`).subscribe(
      (res: any[]) => {
        this.membersLoading[company.id] = false;
        this.members[company.id] = Membership.fromJsonArray(res);
      },
      (err: any) => {
        this.membersLoading[company.id] = false;
        console.error(err);
      }
    );
  }

  removeMember(company: Company, membership: Membership) {
    if(!confirm(`Remover "${membership.email}" desta empresa?`))
      return;

    this.removingMember[membership.user_id] = true;
    this.api.destroy(`companies/${company.id}/members`, membership.user_id).subscribe(
      (res: any) => {
        this.removingMember[membership.user_id] = false;
        this.members[company.id] = (this.members[company.id] || []).filter(m => m.user_id !== membership.user_id);
      },
      (err: any) => {
        this.removingMember[membership.user_id] = false;
        alert(err?.status === 422 ? 'Não é possível remover o último dono da empresa' : 'Não foi possível remover o usuário');
        console.error(err);
      }
    );
  }

  private _checkUserExists(email: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.api.req('users', { email: email }, { collection: 'exists' }, 'get').subscribe(
        (res: { exists: boolean }) => resolve(!!res.exists),
        (err: any) => reject(err)
      );
    });
  }

  private _addMemberErrorMessage(err: any): string {
    if(err?.status === 403) {
      return 'Apenas o dono da empresa pode adicionar usuários';
    }
    if(err?.status === 422) {
      return 'Este usuário já faz parte da empresa';
    }
    return 'Não foi possível adicionar o usuário. Tente novamente';
  }

  createCompany() {
    if(!this.newCompanyName) {
      this.errorMessage = 'Preencha o nome da empresa';
      return;
    }

    this.errorMessage = '';
    this.creating = true;

    this.api.create('companies', {
      company: { name: this.newCompanyName }
    }).subscribe(
      (res: any) => {
        this.creating = false;
        this.selectCompany(new Company(res));
      },
      (err: any) => {
        this.creating = false;
        this.errorMessage = 'Não foi possível criar a empresa. O nome já pode estar em uso';
        console.error(err);
      }
    );
  }

  private _loadCompanies() {
    this.loading = true;
    this.api.index('companies').subscribe(
      (res: any[]) => {
        this.loading = false;
        this.companies = (res || []).map(c => new Company(c));
      },
      (err: any) => {
        this.loading = false;
        this.errorMessage = 'Não foi possível carregar suas empresas';
        console.error(err);
      }
    );
  }
}
