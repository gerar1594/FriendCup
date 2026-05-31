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

        this.route.params.subscribe(params => {
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
                this.leagueData.set(res.league[0]);
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
}