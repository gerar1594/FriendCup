import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Accedemos al ID del usuario actual desde tu servicio de autenticación

    const authService = inject(AuthService);
    const userId = authService.currentUser()?.idPlayer;
    // Si el usuario está logueado y tiene ID, lo clonamos en la cabecera
    if (userId) {
        req = req.clone({
            setHeaders: {
                'X-User-Id': String(userId)
            }
        });
    }

    return next(req);
};