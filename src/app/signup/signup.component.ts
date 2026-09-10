import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCircleExclamation,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
  faUser
} from '@fortawesome/free-solid-svg-icons';

import { User } from '../shared/models/user';
import { ApiService } from '../shared/services/api.service';
import { AuthLayoutComponent } from '../shared/components/auth-layout/auth-layout.component';
import { isValidEmail, parseApiError, parseFieldErrors } from '../shared/helpers/api-errors';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule, RouterLink, FaIconComponent, AuthLayoutComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  name: string = '';
  email: string = '';
  password: string = '';
  passwordConfirmation: string = '';

  errorMessage: string = '';
  fieldErrors: Record<string, string> = {};
  submitting: boolean = false;
  submitted: boolean = false;
  nameTouched: boolean = false;
  emailTouched: boolean = false;
  passwordTouched: boolean = false;
  confirmationTouched: boolean = false;
  showPassword: boolean = false;
  showPasswordConfirmation: boolean = false;

  userIcon = faUser;
  envelopeIcon = faEnvelope;
  lockIcon = faLock;
  eyeIcon = faEye;
  eyeSlashIcon = faEyeSlash;
  alertIcon = faCircleExclamation;

  constructor(private api: ApiService, private router: Router) {
    this.api.noAuth();
  }

  get nameError(): string {
    if(!this.submitted && !this.nameTouched) return '';
    if(!this.name.trim()) return 'Informe seu nome';
    return this.fieldErrors['name'] || '';
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
    if(this.password.length < 8) return 'A senha deve ter ao menos 8 caracteres';
    return this.fieldErrors['password'] || '';
  }

  get confirmationError(): string {
    if(!this.submitted && !this.confirmationTouched) return '';
    if(!this.passwordConfirmation) return 'Confirme a senha';
    if(this.password && this.passwordConfirmation !== this.password) return 'As senhas não conferem';
    return this.fieldErrors['password_confirmation'] || this.fieldErrors['passwordConfirmation'] || '';
  }

  get passwordStrength(): { level: number, label: string } {
    const password = this.password || '';
    if(!password) return { level: 0, label: '' };
    if(password.length < 8) return { level: 1, label: 'Fraca' };

    let score = 1;
    if(/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if(/\d/.test(password)) score++;
    if(/[^A-Za-z0-9]/.test(password)) score++;

    if(score <= 2) return { level: 2, label: 'Média' };
    return { level: 3, label: 'Forte' };
  }

  signup() {
    this.submitted = true;
    this.nameTouched = true;
    this.emailTouched = true;
    this.passwordTouched = true;
    this.confirmationTouched = true;
    this.errorMessage = '';
    this.fieldErrors = {};

    if(this.nameError || this.emailError || this.passwordError || this.confirmationError) {
      this.errorMessage = 'Corrija os campos destacados para continuar';
      return;
    }

    this.submitting = true;

    this.api.create('users', {
      user: { name: this.name.trim(), email: this.email.trim(), password: this.password }
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
        this.errorMessage = parseApiError(err, 'Não foi possível criar sua conta. Verifique os dados e tente novamente.');
        console.error(err);
      }
    });
  }

  onFieldChange() {
    this.errorMessage = this.submitted && (this.nameError || this.emailError || this.passwordError || this.confirmationError)
      ? 'Corrija os campos destacados para continuar'
      : '';
    this.fieldErrors = {};
  }
}
