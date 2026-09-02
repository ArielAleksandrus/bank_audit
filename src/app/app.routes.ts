import { Routes } from '@angular/router';
import { ParserComponent } from './parser/parser.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { CompanySelectComponent } from './company-select/company-select.component';
import { InsertionComponent } from './insertion/insertion.component';
import { ReportComponent } from './report/report.component';
import { companyGuard } from './shared/guards/company.guard';
import { selectedCompaniesGuard } from './shared/guards/selected-companies.guard';

export const routes: Routes = [{
	path: 'login', component: LoginComponent
},{
	path: 'signup', component: SignupComponent
},{
	path: 'companies', component: CompanySelectComponent
},{
	path: 'relatorio-multi', component: ReportComponent, canActivate: [selectedCompaniesGuard]
},{
	path: ':companySlug',
	canActivate: [companyGuard],
	children: [{
		path: 'dashboard', component: DashboardComponent
	},{
		path: 'relatorio', component: ReportComponent
	},{
		path: 'inserir', component: InsertionComponent
	},{
		path: 'parser', component: ParserComponent
	}]
},{
	path: '', component: LoginComponent
}];
