import { Component, inject, input, model, OnInit, output } from '@angular/core';
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
    jornadas = input.required<number[]>();

    onSaved = output<void>();


    // 2. Servicios inyectados
    private matchService = inject(MatchesService);
    private notifService = inject(NotificationService);


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
            dayTrip: this.newMatchForm.dayTrip
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