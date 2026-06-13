import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { LeaguesService } from '../../services/leagues/leagues-service.service';
import { NotificationService } from '../../services/notification/notification.service';

@Component({
    selector: 'app-auth',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './auth.html',
    styleUrls: ['./auth.scss']
})
export class AuthComponent implements OnInit {
    
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private leaguesService = inject(LeaguesService);
    private notificationService = inject(NotificationService);
    private router = inject(Router);

    // Signal para cambiar entre modo Login (true) o Registro (false)
    isLoginMode = signal<boolean>(true);
    errorMessage = signal<string>('');

    // Declaramos el tipo del formulario (se inicializa limpiamente en el ngOnInit -> initForm)
    authForm!: FormGroup;

    ngOnInit(): void {
        this.initForm();
        if (this.authService.currentUser()) {
            this.router.navigate(['/leagues/manage']);
        }
    }

    private initForm() {
        this.authForm = this.fb.group({
            // En login acepta tanto Correo como Nombre de usuario
            Email: ['', [Validators.required]], 
            Password: ['', [Validators.required, Validators.minLength(6)]],
            Nombre: ['']
        });
        this.updateValidators();
    }

    /**
     * Ajusta dinámicamente las restricciones del formulario según el modo actual
     */
    private updateValidators() {
        const emailControl = this.authForm.get('Email');
        const nombreControl = this.authForm.get('Nombre');

        if (this.isLoginMode()) {
            // Modo Login: El campo acepta texto plano (username) o formato email de forma indistinta
            emailControl?.setValidators([Validators.required]);
            nombreControl?.clearValidators();
        } else {
            // Modo Registro: El campo Email es estrictamente un correo electrónico y el Nombre es obligatorio
            emailControl?.setValidators([Validators.required, Validators.email]);
            nombreControl?.setValidators([Validators.required, Validators.minLength(3)]);
        }

        // Forzamos a Angular a recalcular el estado de validez de los inputs de inmediato
        emailControl?.updateValueAndValidity();
        nombreControl?.updateValueAndValidity();
    }

    toggleMode() {
        this.errorMessage.set('');
        this.isLoginMode.update(mode => !mode);
        this.authForm.reset();
        
        // ✨ CORRECCIÓN CRÍTICA: Reasignamos los validadores correspondientes al nuevo modo tras resetear
        this.updateValidators();
    }

    onSubmit() {
        if (this.authForm.invalid) return;

        const data = this.authForm.value;

        if (this.isLoginMode()) {
            this.authService.login(data).subscribe({
                next: (res: any) => {
                    // 1. Guardamos el estado en la señal global
                    this.authService.loginSuccess(res);

                    // 2. Comprobamos si venía de un enlace 'friendcup.com/invite/CODIGO'
                    const pendingCode = localStorage.getItem('pending_invite_code');
                    if (pendingCode) {
                        localStorage.removeItem('pending_invite_code');
                        console.log('🔗 Código de invitación pendiente detectado:', pendingCode);

                        // Te unes a la liga de golpe y te redirige a ella
                        this.leaguesService.joinLeague({
                            InvitationCode: pendingCode, 
                            IDPlayer: this.authService.currentUser().idPlayer
                        }).subscribe({
                            next: (joinRes: any) => this.router.navigate(['/league', joinRes.idLeague]),
                            error: (err) => {
                                console.error('Error al unirse a la liga con código pendiente:', pendingCode);
                                this.notificationService.show('No se pudo unir a la liga con el código proporcionado. Redirigiendo al dashboard.' + err.error?.message, 'error');
                                this.router.navigate(['/leagues/manage']);
                            }
                        });
                    } else {
                        // Si no hay invitación, al dashboard normal
                        this.router.navigate(['/']);
                    }
                },
                error: (err) => {
                    this.notificationService.show('Credenciales incorrectas: ' + (err.error?.message || 'Error de autenticación'), 'error');
                }
            });
        } else {
            // PROCESAR REGISTRO
            if (!data.Nombre) {
                this.errorMessage.set('El nombre es obligatorio para el registro.');
                return;
            }
            this.authService.register(data).subscribe({
                next: () => {
                    this.notificationService.show('¡Cuenta creada con éxito! Ya puedes iniciar sesión.', 'success');
                    this.toggleMode();
                },
                error: (err) => this.errorMessage.set(err.error?.message || 'Error en el registro.')
            });
        }
    }
}