import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html'
})
export class ForgotPassword {
    // Estado de la vista: 'email' o 'username'
    recoveryMethod = signal<'email' | 'username'>('email');
    
    // Variables del formulario
    inputValue = signal<string>('');
    
    // Estados de la petición
    isLoading = signal<boolean>(false);
    successMessage = signal<string>('');
    errorMessage = signal<string>('');

    setMethod(method: 'email' | 'username') {
        this.recoveryMethod.set(method);
        this.inputValue.set('');
        this.errorMessage.set('');
        this.successMessage.set('');
    }

    onSubmit() {
        if (!this.inputValue()) {
            this.errorMessage.set('Por favor, introduce un valor válido.');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set('');
        this.successMessage.set('');

        // Simulamos la llamada al backend
        setTimeout(() => {
            this.isLoading.set(false);

            if (this.recoveryMethod() === 'email') {
                // Lógica de éxito para Email
                this.successMessage.set('Te hemos enviado un enlace de recuperación a tu correo electrónico.');
            } else {
                // Lógica de éxito para Usuario sin Email (Ejemplo: Instrucciones alternativas)
                this.successMessage.set('Hemos notificado al administrador de tu liga. Él te proporcionará una contraseña temporal.');
            }
        }, 1500);
    }
}