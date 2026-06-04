import { Component, inject, input, output, signal, Signal } from '@angular/core';
import { AuthService } from '../../../services/auth/auth.service';
import { NotificationService } from '../../../services/notification/notification.service';
import { CommonModule } from '@angular/common';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';

@Component({
    selector: 'app-clasification',
    imports: [CommonModule],
    templateUrl: './clasification.html',
    styleUrl: './clasification.scss',
})
export class Clasification {
    classification = input.required<any[]>();
    idLeague = input.required<number>();

    onLeagueDataRefresh = output<void>();

    isEditingName = signal<boolean>(false);
    editNameValue = signal<string>('');



    private authService = inject(AuthService);
    private leaguesService = inject(LeaguesService);
    private notifService = inject(NotificationService);

    isEqualUser(playerName: string): boolean {
        return playerName === this.authService.currentUser()?.nombre;
    }

    onStartEdit() {
        // Buscamos el nombre que tiene actualmente (優先 NamePlayerLeague, si no NamePlayer)
        const miFila = this.classification().find(row => row.IsCurrentUser);
        const nombreActual = miFila ? (miFila.NamePlayerLeague || miFila.NamePlayer) : '';

        this.editNameValue.set(nombreActual);
        this.isEditingName.set(true);
    }

    // 3. Función que guarda los cambios al pulsar el "tick"
    onSaveInlineName() {
        const nuevoNombre = this.editNameValue().trim();
        const miFila = this.classification().find(row => row.IsCurrentUser);
        const nombreActual = miFila ? (miFila.NamePlayerLeague || miFila.NamePlayer) : '';

        // Si el nombre se queda vacío, no hacemos nada
        if (!nuevoNombre) {
            this.isEditingName.set(false);
            return;
        }

        // Si el nombre no ha cambiado, simplemente cerramos el modo edición
        if (nuevoNombre === nombreActual) {
            this.isEditingName.set(false);
            return;
        }

        // Si ha cambiado, disparamos la petición al servicio
        this.leaguesService.updateNamePlayerLeague(this.idLeague(), nuevoNombre).subscribe({
            next: (res: any) => {
                this.notifService.show(res.message, 'success');
                this.isEditingName.set(false); // Cerramos el input
                this.onLeagueDataRefresh.emit();   
                     },
            error: (err) => {
                console.error(err);
                this.notifService.show(err.error?.message || 'Error al cambiar tu apodo', 'error');
            }
        });
    }

    // 4. Función por si pulsa Escape o quiere cancelar
    onCancelEdit() {
        this.isEditingName.set(false);
    }

}
