import { Component, computed, inject, input, model, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../services/notification/notification.service'; // Ajusta la ruta
import { MatchesService } from '../../../services/matches/matches-service.service';
import { PlayerService } from '../../../services/players/player-service.service';

@Component({
    selector: 'app-add-match-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-match-modal.html'
})
export class AddMatchModal{
    
    // 1. Inputs y Modelos Reactivos (Sintaxis Moderna)
    isOpen = model.required<boolean>(); // Dos direcciones: si el hijo lo cambia, el padre se entera
    idLeague = input.required<number>();
    classification = input.required<any[]>();
    jornadas = input.required<any[]>();

    sortedPlayers = computed(() => {
        const players = this.classification();
        const listaPartidos = this.jornadas();
        const jornadaActual = this.selectedDayTrip();
        if (!players) return [];
        // Paso A: Crear el Set de IDs ocupados para la jornada actual
        const busyIds = new Set<number>();
        if (jornadaActual && listaPartidos) {
            listaPartidos.forEach(match => {
                if (String(match.DayTrip) === String(jornadaActual)) {
                    // Añadimos los IDs que jugaron (usa los campos reales de tu objeto match)
                    match.JugadoresLocalNames?.forEach((player: any) => {
                        if (player.IDLeaguePlayer) busyIds.add(player.IDLeaguePlayer);
                    });
                    match.JugadoresVisitanteNames?.forEach((player: any) => {
                        if (player.IDLeaguePlayer) busyIds.add(player.IDLeaguePlayer);
                    });
                }
            });
        }

        // Paso B: Mapeamos los jugadores para meterles la propiedad 'disabled' y luego ordenamos
        return [...players]
            .map(player => ({
                ...player,
                disabled: busyIds.has(player.IDLeaguePlayer) // <-- ¡Propiedad inyectada aquí mismo!
            }))
            .sort((a, b) => {
                if (a.disabled !== b.disabled) {
                    return a.disabled ? 1 : -1; 
                    // Retornar 1 mueve a 'a' hacia abajo; retornar -1 lo mueve hacia arriba.
                }

                // --- CRITERIO 2: Orden alfabético ---
                // Si ambos están disponibles, o ambos ya jugaron, se ordenan de la A a la Z entre ellos.
                const nameA = a.NamePlayerLeague || a.NamePlayer || '';
                const nameB = b.NamePlayerLeague || b.NamePlayer || '';
                return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
            });
    });

    onSaved = output<void>();


    // 2. Servicios inyectados
    private matchService = inject(MatchesService);
    private notifService = inject(NotificationService);
    selectedDayTrip = signal<string>('');

    // 3. Estado interno del formulario
    newMatchForm = {
        local1: 'bot',
        local2: 'bot',
        visitante1: 'bot',
        visitante2: 'bot',
        dayTrip: ''
    };


    // Al abrir o inicializar el formulario, calculamos la jornada propuesta
    resetForm() {
        this.newMatchForm = {
            local1: 'bot',
            local2: 'bot',
            visitante1: 'bot',
            visitante2: 'bot',
            dayTrip: ''
        };
        this.selectedDayTrip.set('');
    }

    closeModal() {
        this.isOpen.set(false); // Cierra el modal notificando automáticamente al padre
    }

    onSaveMatch(event: Event) {
        event.preventDefault();

        if (this.newMatchForm.local1 !== 'bot' && this.newMatchForm.local1 === this.newMatchForm.visitante1) {
            this.notifService.show('El Jugador 1 Local no puede ser el mismo que el Visitante', 'error');
            return;
        }
        const payload = {
            idLeague: this.idLeague(),
            locales: [this.newMatchForm.local1, this.newMatchForm.local2],
            visitantes: [this.newMatchForm.visitante1, this.newMatchForm.visitante2],
            dayTrip: this.selectedDayTrip() || ''
        };
        this.matchService.createManualMatch(payload).subscribe({
            next: (res: any) => {
                this.notifService.show(res.message || 'Partido creado con éxito', 'success');
                this.onSaved.emit();
                this.closeModal(); // Cerramos
            },
            error: (err) => {
                console.error(err);
                this.notifService.show(err.error?.message || 'Error al guardar el partido', 'error');
            }
        });
    }
}