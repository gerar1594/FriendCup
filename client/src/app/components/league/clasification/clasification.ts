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
    isAdmin = input<boolean>(false);

    onLeagueDataRefresh = output<void>();

    isEditingName = signal<boolean>(false);
    editNameValue = signal<string>('');
    selectedPlayerId = signal<string>('');
    currentName = signal<string>('');




    private authService = inject(AuthService);
    private leaguesService = inject(LeaguesService);
    private notifService = inject(NotificationService);

    isEqualUser(playerName: string): boolean {
        return playerName === this.authService.currentUser()?.nombre;
    }

    /*onStartEdit(idPlayer: string) {
        // Buscamos el nombre que tiene actualmente (優先 NamePlayerLeague, si no NamePlayer)
        this.selectedPlayerId.set(idPlayer);
        const miFila = this.classification().find(row => row.IDPlayer === idPlayer);
        const nombreActual = miFila ? (miFila.NamePlayerLeague || miFila.NamePlayer) : '';

        this.editNameValue.set(nombreActual);
        this.isEditingName.set(true);
    }*/

    onStartEdit(playerId: string, currentName: string) {
        this.selectedPlayerId.set(playerId);
        this.editNameValue.set(currentName);
        this.currentName.set(currentName);
    }

    // 3. Función que guarda los cambios al pulsar el "tick"
    onSaveInlineName() {
        const nuevoNombre = this.editNameValue().trim();

        // Si el nombre se queda vacío, no hacemos nada
        if (!nuevoNombre) {
            this.isEditingName.set(false);
            return;
        }

        // Si el nombre no ha cambiado, simplemente cerramos el modo edición
        if (nuevoNombre === this.currentName()) {
            this.isEditingName.set(false);
            this.currentName.set('');
            this.selectedPlayerId.set('');
            return;
        }

        // Si ha cambiado, disparamos la petición al servicio
        this.leaguesService.updateNamePlayerLeague(this.idLeague(), this.selectedPlayerId(), nuevoNombre).subscribe({
            next: (res: any) => {
                this.notifService.show(res.message, 'success');
                this.isEditingName.set(false); // Cerramos el input
                this.selectedPlayerId.set(''); // Limpiamos el ID seleccionado
                this.currentName.set('');
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
        this.selectedPlayerId.set('');
        this.editNameValue.set('');
        this.currentName.set('');
    }

}
