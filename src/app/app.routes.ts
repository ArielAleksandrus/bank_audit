import { Routes } from '@angular/router';
import { ParserComponent } from './parser/parser.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { InsertionComponent } from './insertion/insertion.component';

export const routes: Routes = [{
	path: 'parser', component: ParserComponent
},{
	path: 'dashboard', component: DashboardComponent
},{
	path: 'login', component: LoginComponent
},{
	path: 'inserir', component: InsertionComponent
},{
	path: '', component: LoginComponent
}];
