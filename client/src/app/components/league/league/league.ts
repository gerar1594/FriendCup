import { Component, computed, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';
import { AuthService } from '../../../services/auth/auth.service';
import { MatchCard } from "../../match/match-card/match-card";
import { MatchesService } from '../../../services/matches/matches-service.service';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
    selector: 'app-league',
    imports: [MatchCard, CommonModule], // Añadido CommonModule por si usas directivas básicas
    templateUrl: './league.html',
    styleUrl: './league.scss',
})
export class League implements OnInit {
    @ViewChildren('jornadaCard') listaTarjetas!: QueryList<ElementRef>;

    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private leaguesService = inject(LeaguesService);
    private matchService = inject(MatchesService);
    private authService = inject(AuthService);
    private notifService = inject(NotificationService);

    // Signals para reactividad limpia
    idLeague = signal<number>(0);
    idPlayer = signal<number | null>(null);
    isPlayer = signal<boolean>(false);
    isEditingName = signal<boolean>(false);
    editNameValue = signal<string>('');

    leagueData = signal<any>(null);
    classification = signal<any[]>([]);
    protected matches = signal<any[]>([]); 
    adminMode = signal<boolean>(false); 

    // Función auxiliar para agrupar los partidos por Jornada en el HTML
    protected jornadas = computed(() => {
        const todosLosMatches = this.matches();
        const listaJornadas = todosLosMatches.map(m => m.DayTrip);
        return [...new Set(listaJornadas)]; 
    });

    ngOnInit(): void {
        const user = this.authService.currentUser();
        if (user && user.idPlayer) {
            this.idPlayer.set(user.idPlayer);
        } else {
            this.router.navigate(['/login']);
            return;
        }

        // Escuchamos el cambio de parámetros de la URL
        this.route.params.subscribe(params => {
            // 🎯 EL ARREGLO: Apagamos el modo admin inmediatamente al cambiar de torneo
            this.adminMode.set(false); 
            
            this.idLeague.set(Number(params['id']));
            this.loadLeagueData();
        });
    }

    isEqualUser(playerName: string): boolean {
        return playerName === this.authService.currentUser()?.nombre;
    }

    /**
     * Carga todos los datos de la liga.
     * @param retryIfMatchesEmpty Si es true y los partidos vienen vacíos, reintenta la carga tras un delay.
     */
    loadLeagueData(retryIfMatchesEmpty: boolean = false) {
        // 1. Cargar metadatos y clasificación
        this.leaguesService.getLeague(this.idLeague()).subscribe({
            next: (res) => {
                this.leagueData.set(res.league);
                this.classification.set(res.classification);
            },
            error: (err) => {
                this.notifService.show(err.error?.message || 'Error al cargar la liga', 'error');
                this.router.navigate(['/leagues/manage']);
            }
        });

        // 2. Cargar partidos de la liga
        this.matchService.getMatchByLeague(this.idLeague()).subscribe({
            next: (res) => {
                this.matches.set(res.matches);
                
                // Si le pedimos reintentar (porque venimos de un cambio de estado) y aún no hay partidos
                if (retryIfMatchesEmpty && (!res.matches || res.matches.length === 0)) {
                    console.log('⏳ Los partidos aún se están generando en el servidor. Reintentando en 1.5 segundos...');
                    setTimeout(() => {
                        this.loadLeagueData(true); // Reintento recursivo controlado
                    }, 1500);
                } else if (res.matches && res.matches.length > 0) {
                    // Si ya hay partidos, hacemos el scroll correspondiente
                    setTimeout(() => {
                        this.scrollToLastJornada();
                    }, 100);
                }
            },
            error: (err) => {
                console.error('Error al cargar partidos:', err);
            }
        });

        // 3. Verificar si el jugador pertenece a la liga
        const currentUserId = this.authService.currentUser().idPlayer;
        this.leaguesService.isPlayerInLeague(this.idLeague(), currentUserId).subscribe({
            next: (res) => {
                this.isPlayer.set(res.isPlayer);
            },
            error: (err) => {
                console.error('Error verificando acceso a la liga:', err);
            }
        });
    }

    private scrollToLastJornada() {
        if (this.listaTarjetas && this.listaTarjetas.length > 0) {
            const ultimaTarjeta = this.listaTarjetas.last.nativeElement;
            ultimaTarjeta.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center' 
            });
        }
    }

    onLeaveLeague() {
        const confirmar = confirm(`¿Estás seguro de que quieres desinscribirte de "${this.leagueData().NameLeague}"? Perderás todos tus puntos acumulados.`);
        if (confirmar && this.idPlayer()) {
            this.leaguesService.leaveLeague(this.idLeague(), this.idPlayer()!).subscribe({
                next: (res) => {
                    this.notifService.show(res.message, 'success');
                    this.leaguesService.triggerRefresh();
                    this.router.navigate(['/leagues/manage']); 
                },
                error: (err) => this.notifService.show('Error al procesar la baja: ' + err.error.message, 'error')
            });
        }
    }

    onToggleAdminMode() {
        this.adminMode.set(!this.adminMode());
    }

    getMatchesByJornada(jornada: number) {
        return this.matches().filter(m => m.DayTrip === jornada);
    }

    isAdmin(): boolean {
        return this.leagueData()?.IDAdmin == this.authService.currentUser()?.idPlayer;
    }

    copiarEnlaceInvitacion() {
        const baseUrL = window.location.origin; 
        const enlace = `${baseUrL}/invite/${this.leagueData().InvitationCode}`;
        
        navigator.clipboard.writeText(enlace).then(() => {
            // 🔥 Añadido mensaje visual con tu NotificationService
            this.notifService.show('¡Enlace de invitación copiado al portapapeles! 🔗', 'success');
        }).catch(() => {
            this.notifService.show('No se pudo copiar el enlace automáticamente', 'error');
        });
    }

    onChangeLeagueState(event: Event) {
        const selectElement = event.target as HTMLSelectElement;
        const nuevoEstado = selectElement.value;
        const idLeague = this.leagueData().IDLeague;

        this.leaguesService.updateLeagueState(idLeague, nuevoEstado).subscribe({
            next: () => {
                this.notifService.show(`Estado de la liga actualizado a "${nuevoEstado}"`, 'success');
                
                // 🔥 PASAMOS 'true': Si el estado cambió a 'En Curso', le decimos a la función 
                // que si ve los partidos vacíos active el bucle de espera hasta que el backend termine.
                const comprobarPartidos = nuevoEstado === 'En Curso';
                this.loadLeagueData(comprobarPartidos); 
            },
            error: (err) => {
                console.error(err);
                this.notifService.show('Error al cambiar el estado de la liga', 'error');
            }
        });
    }

    onChangeTypeJornada(event: Event) {
        const selectElement = event.target as HTMLSelectElement;
        const nuevoTypeJornada = selectElement.value;
        const idLeague = this.leagueData().IDLeague;
        this.leagueData().Configuration.jornada.tipo = nuevoTypeJornada; // Actualizamos el tipo de jornada en el frontend para que se refleje inmediatamente
        /*this.leaguesService.updateLeagueTypeJornada(idLeague, nuevoTypeJornada).subscribe({
            next: () => {
                this.notifService.show(`Tipo de jornada actualizado a "${nuevoTypeJornada}"`, 'success');
                this.loadLeagueData();
            },
            error: (err) => {
                console.error(err);
                this.notifService.show('Error al cambiar el tipo de jornada de la liga', 'error');
            }
        });*/
    }
    onChangeValueJornada(event: Event) {
        const selectElement = event.target as HTMLSelectElement;
        const nuevoValueJornada = selectElement.value;
        const idLeague = this.leagueData().IDLeague;
        this.leagueData().Configuration.jornada.value = nuevoValueJornada; // Actualizamos el tipo de jornada en el frontend para que se refleje inmediatamente
        /*this.leaguesService.updateLeagueTypeJornada(idLeague, nuevoTypeJornada).subscribe({
            next: () => {
                this.notifService.show(`Tipo de jornada actualizado a "${nuevoTypeJornada}"`, 'success');
                this.loadLeagueData();
            },
            error: (err) => {
                console.error(err);
                this.notifService.show('Error al cambiar el tipo de jornada de la liga', 'error');
            }
        });*/
    }


    onSaveConfiguration(){
        this.leaguesService.updateLeagueConfiguration(this.leagueData().IDLeague, this.leagueData().Configuration).subscribe({
            next: () => {
                this.notifService.show(`Configuración de la liga actualizada`, 'success');
                this.loadLeagueData();
            },
            error: (err) => {
                console.error(err);
                this.notifService.show('Error al actualizar la configuración de la liga', 'error');
            }
        });
    }


    onReset() {
        const confirmar = confirm('⚠️ ¿CUIDADO! ¿Estás completamente seguro de que quieres reiniciar la liga? Esto borrará TODOS los partidos generados, los resultados introducidos y pondrá la clasificación a 0. Esta acción no se puede deshacer.');
        
        if (confirmar) {
            const idLeague = this.idLeague();
            
            this.leaguesService.resetLeague(idLeague).subscribe({
                next: (res: any) => {
                    this.notifService.show(res.message || 'La liga se ha reiniciado correctamente. 🔄', 'success');
                    // Forzamos la recarga de datos para limpiar el calendario y actualizar la tabla en la vista
                    this.loadLeagueData(); 
                },
                error: (err) => {
                    console.error(err);
                    this.notifService.show(err.error?.message || 'Error al reiniciar la liga', 'error');
                }
            });
        }
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
                this.loadLeagueData(); // 🔄 Recargamos para actualizar la tabla
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