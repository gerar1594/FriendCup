import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    // Señal que almacena el mensaje actual o null si no hay ninguno activo
    public currentToast = signal<ToastMessage | null>(null);

    /**
     * Muestra un mensaje en pantalla que se destruye automáticamente
     * @param text Texto a mostrar
     * @param type Tipo de alerta (success, error, info)
     * @param duration Duración en milisegundos (por defecto 3 segundos)
     */
    public show(text: string, type: 'success' | 'error' | 'info' = 'success', duration: number = 3000): void {
        // Seteamos el nuevo mensaje
        this.currentToast.set({ text, type });

        // Programamos su destrucción automática
        setTimeout(() => {
        // Validamos que el mensaje actual sea el mismo (por si se ha disparado otro entre medias)
        if (this.currentToast()?.text === text) {
            this.clear();
        }
        }, duration);
    }

    public clear(): void {
        this.currentToast.set(null);
    }
}