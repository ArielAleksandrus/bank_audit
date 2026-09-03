import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { Company } from '../models/company';
import { User } from '../models/user';
import { ApiService } from '../services/api.service';

/**
 * Guards every route nested under '/:companySlug'. Loads the locally
 * stored user/company, checks the slug in the URL still matches the
 * stored company, and sets the request auth headers for the children.
 */
export const companyGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const api = inject(ApiService);

  const user = User.loadUser();
  if(!user || !user.token) {
    router.navigate(['/login']);
    return false;
  }

  const company = Company.loadCompany();
  if(!company) {
    router.navigate(['/companies']);
    return false;
  }

  const slug = route.paramMap.get('companySlug');
  if(slug !== Company.slugify(company.name)) {
    router.navigate(['/companies']);
    return false;
  }

  // Both tokens are sent so the API can resolve the user's membership role
  // in this company (e.g. capping what a 'buyer' can read back) - not just
  // that the company token is valid.
  api.setAuth({ token: company.token, 'User-Token': user.token });
  return true;
};
