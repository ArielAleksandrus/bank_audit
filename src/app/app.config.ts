import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { NgxMaskConfig, provideEnvironmentNgxMask } from 'ngx-mask';

import { routes } from './app.routes';

const maskConfig: Partial<NgxMaskConfig> = {
  validation: false,
};

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),
              provideRouter(routes),
              provideHttpClient(),
              provideEnvironmentNgxMask(maskConfig)]
};
