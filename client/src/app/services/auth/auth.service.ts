import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private API_URL = `${environment.apiUri}/auth`;

    // Signal global con los datos del usuario (se lee de localStorage al iniciar)
    public currentUser = signal<any>(JSON.parse(localStorage.getItem('user') || 'null'));

    public isLoggedIn() {
        return this.currentUser() !== null;
    }
    register(user: any): Observable<any> {
        return this.http.post(`${this.API_URL}/register`, user);
    }

    public loginSuccess(res: any): void {
        if (!res || !res.user) {
            console.error('Respuesta de login inválida en el cliente');
            return;
        }

        // Guardamos físicamente en el navegador
        localStorage.setItem('token', res.token);
        localStorage.setItem('user_session', JSON.stringify(res.user));

        // 🔥 Modificamos la señal. Esto despierta instantáneamente el effect() del LeaguesService
        this.currentUser.set(res.user); 
    }

    login(credentials: any): Observable<any> {
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
        console.log(`${this.API_URL}/login`, credentials);
        return this.http.post<any>(`${this.API_URL}/login`, credentials, {headers}).pipe(
            tap(res => {
                // Almacenar sesión en el navegador
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify(res.user));
                // Actualizar la Signal (el Navbar se enterará automáticamente)
                this.currentUser.set(res.user);
            })
        );
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.clear();
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    getToken() {
        return localStorage.getItem('token');
    }

}