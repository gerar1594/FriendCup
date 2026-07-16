import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/authInterceptor';

import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { loadingInterceptor } from './core/interceptors/loadingInterceptor';


registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        provideHttpClient(
            withInterceptors([authInterceptor, loadingInterceptor])
        ),
        { provide: LOCALE_ID, useValue: 'es' }
    ]
};
