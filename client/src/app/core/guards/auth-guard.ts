import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    
    // Aquí verificas si el usuario está logueado. 
    // Por ejemplo, comprobando si existe un token en localStorage:
    const token = localStorage.getItem('token'); // O usa tu AuthService
    
    if (token) {
        return true; // El usuario está logueado, le dejamos pasar
    } else {
        // No está logueado, lo enviamos al login
        router.navigate(['/login']);
        return false; // Bloqueamos la navegación a la ruta protegida
    }
};

export const publicGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const token = localStorage.getItem('token');
    
    if (token) {
        router.navigate(['/home']); // Si ya está logueado, lo sacamos del login
        return false;
    }
    return true; // Si NO está logueado, le dejamos ver la pantalla de login
};