import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthService } from '../../../services/auth/auth.service';
import { ModifyMatchDialog } from "../modify-match-dialog/modify-match-dialog";
import { MatchesService } from '../../../services/matches/matches-service.service';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
    selector: 'app-match-card',
    imports: [ModifyMatchDialog, CommonModule],
    templateUrl: './match-card.html',
    styleUrl: './match-card.scss',
})
export class MatchCard {

    private matchesService = inject(MatchesService);
    private notificationService = inject(NotificationService);
    
    
    match = input.required<any>();
    showDatails = input<boolean>(false);
    adminMode = input<boolean>(false);


    protected formPeriodos = signal<any[]>([]);
    private authService = inject(AuthService);

    private userId = this.authService.currentUser()?.idPlayer;

    protected selectedMatch = signal<any>(null);

    loadMatches = output<void>();


    protected puedeEditar = computed(() => {
        const partido = this.match();
        // Si no vienen IDs de jugadores, por seguridad no dejamos editar
        if( this.adminMode() ) {
            return true; // Si estás en modo admin, puedes editar cualquier partido
        }
        if (!partido || !partido.IDsJugadoresPartido) return false;

        // Convertimos el String "2,5,14" en un Array de números reales: [2, 5, 14]
        const idsArray = partido.IDsJugadoresPartido.split(',').map((id: string) => Number(id));

        // Validamos si nuestra ID está incluida en ese listado
        return idsArray.includes(this.userId);
    });
    protected confirmar = computed(() => {
        const match = this.match();
        const currentUserId = this.authService.currentUser().idPlayer; // Ajusta según cómo obtengas el ID del usuario actual
        // 1. Si el partido ya está Finalizado o Pendiente absoluto, nadie confirma nada
        if (match.Estado === 'Jugado' || match.Estado === 'Pendiente') {
            return false;
        }

        // 2. Averiguamos a qué bando pertenece el usuario actual en este partido
        // Puedes comprobarlo buscando su ID en los arrays dinámicos que preparamos en el backend:
        const localesIDs = match.JugadoresLocalIDs ? match.JugadoresLocalIDs.split(',').map(Number) : [];
        const visitantesIDs = match.JugadoresVisitanteIDs ? match.JugadoresVisitanteIDs.split(',').map(Number) : [];

        const esLocal = localesIDs.includes(currentUserId);
        const esVisitante = visitantesIDs.includes(currentUserId);
        if(this.adminMode()) {
            return true; // Si eres admin, puedes confirmar cualquier partido
        }

        if (match.Estado == 'Confirmado Visitante' && esLocal) {
            return true;
        }

        if (match.Estado == 'Confirmado Local' && esVisitante) {
            return true;
        }

        // En cualquier otro caso (ej: tú eres Local, pero el estado es 'Confirmado Local', estás esperando al rival)
        return false;
    });

    constructor() {
        // Usamos un timeout pequeño para asegurar que el input() esté disponible
        setTimeout(() => {
            const marcador = this.match().Resultado;
            if (marcador && marcador.periodos) {
                // Deep clone para editar sin afectar la lista de fondo
                this.formPeriodos.set(JSON.parse(JSON.stringify(marcador.periodos)));
            }
        }, 0);

    }

    loadUserMatches() {
        this.loadMatches.emit();
    }

    openEditModal() {
        this.selectedMatch.set(this.match());

        // Como el backend inicializa 'Marcador' con sus periodos correspondientes,
        // simplemente clonamos el array de periodos para que el usuario edite los inputs.
        if (this.match().Resultado && this.match().Resultado.periodos) {
            // Hacemos una copia profunda (deep clone) para no modificar la tarjeta de fondo antes de guardar
            this.formPeriodos.set(JSON.parse(JSON.stringify(this.match().Resultado.periodos)));
        } else {
            // Caso de emergencia por si hay algún partido antiguo en la BBDD sin inicializar
            this.formPeriodos.set([{ label: 'Goles', local: 0, visitante: 0 }]);
        }
    }

    validateMatch() {
        const idMatch = this.match().IDMatch;

        if(this.adminMode()) {
            if(this.authService.currentUser()) {
                const payload = { idPlayer: this.authService.currentUser().idPlayer,
                    periodos: this.formPeriodos()
                }; // Enviamos solo los periodos, el backend recalculará los totales
                console.log('Payload admin:', payload.periodos);
                this.matchesService.validateMatchAdmin(idMatch, payload).subscribe({
                    next: (res) => {
                        this.notificationService.show(res.message, 'success');
                        this.loadMatches.emit();
                    },
                    error: (err) =>  this.notificationService.show(err.message, 'error')

                });
            }
        }else{
            if(this.authService.currentUser()) {
                const payload = { idPlayer: this.authService.currentUser().idPlayer }; // Enviamos solo los periodos, el backend recalculará los totales

                this.matchesService.validateMatch(idMatch, payload).subscribe({
                    next: (res) => {
                        this.notificationService.show(res.message, 'success');
                        this.loadMatches.emit();
                    },
                    error: (err) => this.notificationService.show(err.message, 'error')
                });
            }
        }
    }

    closeModal() {
        this.selectedMatch.set(null);
    }
}
