import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { NgxMaskConfig, provideEnvironmentNgxMask } from 'ngx-mask';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';

registerLocaleData(localePt, 'pt-BR');

const maskConfig: Partial<NgxMaskConfig> = {
  validation: false,
};

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }),
              provideRouter(routes),
              provideHttpClient(),
              provideEnvironmentNgxMask(maskConfig),
              provideAnimationsAsync(),
              { provide: LOCALE_ID, useValue: 'pt-BR' },
              providePrimeNG({
                theme: {
                  preset: Aura
                }
              })]
};
