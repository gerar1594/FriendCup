import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { App } from '../../app';
import { Observable, Subject, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root',
})
export class LeaguesService {

    
    
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private API_URL = environment.apiUri + '/league';

    // 📣 Creamos el emisor de eventos
    private refreshLeagues$ = new Subject<void>();
    userLeagues = signal<any[]>([]);

    constructor() {
        effect(() => {
            const usuario = this.authService.currentUser();
            console.log('🔍 Efecto de LeaguesService detectó cambio en usuario:', usuario);
            if (usuario && usuario.idPlayer) {
                // En cuanto el usuario se loguea (deja de ser null), 
                // el efecto se entera solo y dispara la recarga del menú instantáneamente
                console.log('🔄 Detectado login de usuario. Cargando ligas para ID:', usuario.idPlayer);
                this.loadUserOrAdminLeagues(usuario.idPlayer);
            } else {
                // Si se desloguea, limpiamos el menú lateral
                this.userLeagues.set([]);
            }
        });
    }

    // Exponemos el emisor como un Observable para que los componentes se suscriban
    get onRefreshLeagues(): Observable<void> {
        return this.refreshLeagues$.asObservable();
    }

    // Método para disparar el aviso de actualización
    triggerRefresh() {
        const usuario = this.authService.currentUser();
        if (usuario && usuario.idPlayer) {
            console.log('📢 triggerRefresh activado. Recargando ligas desde la API...');
            this.loadUserOrAdminLeagues(usuario.idPlayer);
        }
        this.refreshLeagues$.next();
    }

    loadUserOrAdminLeagues(userId: number | string) {
        return this.http.get<any[]>(`${this.API_URL}/all/${userId}`).subscribe({
            next: (ligas) => {
                this.userLeagues.set(ligas); // En cuanto llegan, el Navbar se entera solo
            },
            error: (err) => {
                console.error('Error al traer las ligas del usuario:', err);
                this.userLeagues.set([]);
            }
        });
    }

    getLeaguesByUser(userId: number | string): Observable<any[]> {
        return this.http.get<any[]>(`${this.API_URL}/user/${userId}`);
    }
    getLeaguesByUserOrAdmin(userId: number | string): Observable<any[]> {

        return this.http.get<any[]>(`${this.API_URL}/all/${userId}`);
    }
    getLeagueByAdmin(userId: number | string): Observable<any[]> {
        return this.http.get<any[]>(`${this.API_URL}/admin/${userId}`);

    }
    getLeague(idLeague: number): Observable<any> {
        return this.http.get<any>(`${this.API_URL}/${idLeague}`);
    }

    createLeague(leagueData: { NameLeague: string, IDSport: string, IDPlayer: number }): Observable<any> {
        return this.http.post(`${this.API_URL}/create`, leagueData);
    }
    createPlayerInLeague(playerData: { IDLeague: string, IDPlayer: string, NamePlayerLeague: string }): Observable<any> {
        return this.http.post(`${this.API_URL}/create-player`, playerData);
    }

    joinLeague(joinData: { InvitationCode: string, IDLeaguePlayer: string, IDPlayer: string }): Observable<any> {
        return this.http.post(`${this.API_URL}/join`, joinData);
    }
    leaveLeague(idLeague: number, idPlayer: number) {
                console.log(idLeague, idPlayer);

        return this.http.post<any>(`${this.API_URL}/leave`, { idLeague, idPlayer });
    }

    isPlayerInLeague(idLeague: number, idPlayer: number): Observable<any> {
        return this.http.get<any>(`${this.API_URL}/check-access/${idLeague}/${idPlayer}`);
    }

    updateLeagueState(idLeague: any, nuevoEstado: string) {
        return this.http.post<any>(`${this.API_URL}/state/${idLeague}`, {estado: nuevoEstado, idadmin: this.authService.currentUser().idPlayer})
    }
    updateLeagueConfiguration(idLeague: any, configuration: any, resetearJornadas: any) {
        return this.http.post<any>(`${this.API_URL}/config/${idLeague}`, {configuration: configuration, resetearJornadas})
    }

    resetLeague(idLeague: number): Observable<any> {
        return this.http.post(`${this.API_URL}/${idLeague}/reset`, {});
    }
    resetLeagueMatches(idLeague: number): Observable<any> {
        return this.http.post(`${this.API_URL}/${idLeague}/reset-matches`, {});
    }

    updateNamePlayerLeague(idLeague: number, idPlayer: string, newName: string): Observable<any> {
        console.log("Actualizando nombre del jugador en liga:", idLeague, idPlayer, newName);
        return this.http.post(`${this.API_URL}/update-name-player-league`, { idLeague, idPlayer, newName });
    }

    addLike(IDLeague: any): Observable<any>  {
        return this.http.put(`${this.API_URL}/add-like/${IDLeague}`,{});
    }
    
    deleteLike(IDLeague: any): Observable<any>  {
        return this.http.delete(`${this.API_URL}/delete-like/${IDLeague}`);
    }

    searchLeagues(term: string): Observable<any> {
        return this.http.get(`${this.API_URL}/search`, {
            params: { search: term }
        });
    }
}
