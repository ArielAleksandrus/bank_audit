import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCircleExclamation,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock
} from '@fortawesome/free-solid-svg-icons';

import { Company } from '../shared/models/company';
import { User } from '../shared/models/user';
import { ApiService } from '../shared/services/api.service';
import { AuthLayoutComponent } from '../shared/components/auth-layout/auth-layout.component';
import { isValidEmail, parseApiError, parseFieldErrors } from '../shared/helpers/api-errors';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink, FaIconComponent, AuthLayoutComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';

  errorMessage: string = '';
  fieldErrors: Record<string, string> = {};
  submitting: boolean = false;
  submitted: boolean = false;
  emailTouched: boolean = false;
  passwordTouched: boolean = false;
  showPassword: boolean = false;

  envelopeIcon = faEnvelope;
  lockIcon = faLock;
  eyeIcon = faEye;
  eyeSlashIcon = faEyeSlash;
  alertIcon = faCircleExclamation;

  constructor(private api: ApiService, private router: Router) {
    this.api.noAuth();
  }

  ngOnInit() {
    let user = User.loadUser();
    if(user && user.token) {
      let company = Company.loadCompany();
      if(company) {
        this.router.navigate(['/', Company.slugify(company.name), 'dashboard']);
      } else {
        this.router.navigate(['/companies']);
      }
    }
  }

  get emailError(): string {
    if(!this.submitted && !this.emailTouched) return '';
    if(!this.email.trim()) return 'Informe o e-mail';
    if(!isValidEmail(this.email)) return 'Informe um e-mail válido';
    return this.fieldErrors['email'] || '';
  }

  get passwordError(): string {
    if(!this.submitted && !this.passwordTouched) return '';
    if(!this.password) return 'Informe a senha';
    return this.fieldErrors['password'] || '';
  }

  login() {
    this.submitted = true;
    this.emailTouched = true;
    this.passwordTouched = true;
    this.errorMessage = '';
    this.fieldErrors = {};

    if(this.emailError || this.passwordError) {
      this.errorMessage = 'Corrija os campos destacados para continuar';
      return;
    }

    this.submitting = true;

    this.api.create('session', {
      session: { email: this.email.trim(), password: this.password }
    }).subscribe({
      next: (res: any) => {
        this.submitting = false;
        User.storeUser(new User(res));
        this.api.setAuth({ 'User-Token': res.token });
        this.router.navigate(['/companies']);
      },
      error: (err: any) => {
        this.submitting = false;
        this.fieldErrors = parseFieldErrors(err);
        this.errorMessage = parseApiError(err, 'E-mail ou senha inválidos');
        console.error(err);
      }
    });
  }

  onFieldChange() {
    this.errorMessage = this.submitted && (this.emailError || this.passwordError)
      ? 'Corrija os campos destacados para continuar'
      : '';
    this.fieldErrors = {};
  }
}
