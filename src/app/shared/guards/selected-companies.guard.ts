import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Company } from '../models/company';
import { User } from '../models/user';

/**
 * Guards the combined multi-company report route. Unlike companyGuard,
 * there's no single company slug to check against here — it just makes
 * sure a user is logged in and a non-empty set of companies was picked
 * on the companies page.
 */
export const selectedCompaniesGuard: CanActivateFn = () => {
  const router = inject(Router);

  const user = User.loadUser();
  if(!user || !user.token) {
    router.navigate(['/login']);
    return false;
  }

  const companies = Company.loadSelectedCompanies();
  if(!companies || companies.length === 0) {
    router.navigate(['/companies']);
    return false;
  }

  return true;
};
