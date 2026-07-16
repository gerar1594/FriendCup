import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
    public isLoading = signal<boolean>(false);
    private activeRequests = 0;
    private timeoutId: any; // ⏱️ Variable para guardar el temporizador

    show(reqUrl: string) {
        this.activeRequests++;
        
        // Solo iniciamos el temporizador en la primera petición activa
        if (this.activeRequests === 1) {
        // ⏱️ Esperamos 800ms antes de mostrar la pantalla gigante
        this.timeoutId = setTimeout(() => {
            this.isLoading.set(true);
        }, 800);
        }
    }

    hide(reqUrl: string) {
        this.activeRequests--;
        
        if (this.activeRequests <= 0) {
        this.activeRequests = 0;
        
        // 🛑 Si la petición terminó rápido, cancelamos el temporizador 
        // para que el spinner nunca llegue a mostrarse.
        clearTimeout(this.timeoutId); 
        
        this.isLoading.set(false);
        }
    }
}