import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AuthService } from '../../../services/auth/auth.service';
import { ModifyMatchDialog } from "../modify-match-dialog/modify-match-dialog";
import { MatchesService } from '../../../services/matches/matches-service.service';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification/notification.service';
import { BetsService } from '../../../services/bets/bets-service.service';
import { DatePicker } from '../../date-picker/date-picker';

@Component({
    selector: 'app-match-card',
    imports: [ModifyMatchDialog, CommonModule, DatePicker],
    templateUrl: './match-card.html',
    styleUrl: './match-card.scss',
})
export class MatchCard {

    private matchesService = inject(MatchesService);
    private betsService = inject(BetsService);

    private notificationService = inject(NotificationService);
    
    
    match = input.required<any>();
    showDatails = input<boolean>(false);
    adminMode = input<boolean>(false);
    namePlayerLeague = input<boolean>(false);


    protected formPeriodos = signal<any[]>([]);
    private authService = inject(AuthService);

    isModify = signal<boolean>(false);

    private userId = this.authService.currentUser()?.idPlayer;

    protected selectedMatch = signal<any>(null);

    loadMatches = output<void>();

    showDatePicker = signal<boolean>(false);


    protected puedeEditar = computed(() => {
        const partido = this.match();
        // Si no vienen IDs de jugadores, por seguridad no dejamos editar
        if( this.adminMode() || partido.DayTrip === null ) {
            return true; // Si estás en modo admin, puedes editar cualquier partido
        }
        if(partido.bando === null) return false;
        return true;
    });
    protected confirmar = computed(() => {
        const match = this.match();
        const currentUserId = this.authService.currentUser().idPlayer; // Ajusta según cómo obtengas el ID del usuario actual
        // 1. Si el partido ya está Finalizado o Pendiente absoluto, nadie confirma nada
        if (match.Estado === 'Jugado' || match.Estado === 'Pendiente') {
            return false;
        }
        if(this.adminMode()) {
            return true; // Si eres admin, puedes confirmar cualquier partido
        }
        if (match.Estado == 'Confirmado Visitante' && this.match().bando === 'Local') {
            return true;
        }

        if (match.Estado == 'Confirmado Local' && this.match().bando === 'Visitante') {
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

    deleteMatch() {
        // Aquí iría la lógica para eliminar el partido, probablemente llamando a un método en MatchesService
        // Ejemplo:
        this.matchesService.deleteMatch(this.match().IDMatch).subscribe({
            next: (res) => {
            this.notificationService.show(res.message, 'success');
            this.loadMatches.emit();
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });
    }
    toggleApuesta(bando: 'Local' | 'Visitante' | 'Empate') {
        const partidoActual = this.match();

        // Si hace clic en la que ya estaba seleccionada, la borramos (desmarcar), si no, la guardamos
        const nuevaApuesta = partidoActual.MiApuesta === bando ? null : bando;

        // 1. Actualización optimista de la UI mutando el Signal local
        /*this.match().set({
            ...partidoActual,
            MiApuesta: nuevaApuesta
        });*/
        this.match().MiApuesta = nuevaApuesta;

        // 2. Sincronizamos con la base de datos a través de tu servicio
        this.betsService.saveMatchBet({idMatch: partidoActual.IDMatch, predictedBando: nuevaApuesta}).subscribe({
            error: (err) => {
                console.error("Error al guardar apuesta, revirtiendo...", err);
                // Si el servidor falla de forma imprevista, restauramos el estado anterior
                this.match().set(partidoActual);
            }
        });
    }

    handleFechaSeleccionada(fechaHora: string) {
        console.log('Fecha recibida del componente hijo:', fechaHora);
        this.match().Fecha = fechaHora;

        this.matchesService.setFecha(this.match().IDMatch, {fecha : fechaHora}).subscribe({
            next: (res) => {
            this.notificationService.show(res.message, 'success');
            this.loadMatches.emit();
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });
        // Aquí ejecutas tu servicio HTTP para guardar la fecha en tu base de datos Node/MySQL
    }

    openModifyModal() {
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

}
