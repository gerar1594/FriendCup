import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatchesService } from '../../../services/matches/matches-service.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ModifyMatchDialog } from "../modify-match-dialog/modify-match-dialog";
import { MatchCard } from "../match-card/match-card";

@Component({
    selector: 'app-my-matches',
    imports: [CommonModule, FormsModule, MatchCard],
    templateUrl: './my-matches.html',
    styleUrl: './my-matches.scss',
})
export class MyMatches {
    private matchesService = inject(MatchesService);
    private authService = inject(AuthService);

    protected myMatches = signal<any[]>([]);
    protected selectedMatch = signal<any>(null);
    protected useNamePlayerLeague = signal<boolean>(false);

    selectedLeague = signal<string>('');

    uniqueLeagues = computed(() => {
        const matches = this.myMatches(); // Asumiendo que myMatches es una Signal
        // Extraemos todos los NameLeague, filtramos los vacíos y eliminamos duplicados con Set
        
        const leagues = matches
            .map((match: any) => match.NameLeague)
            .filter((name: string) => !!name);
        
        return Array.from(new Set(leagues)).sort();
    });

    // 3. Computed para obtener los partidos ya filtrados dinámicamente
    filteredMatches = computed(() => {
        const matches = this.myMatches();
        const filter = this.selectedLeague();
        if (!filter) {
            return matches; // Si no hay filtro, devolvemos todos
        }

        return matches.filter((match: any) => match.NameLeague === filter);
    });

    // Variables vinculadas al formulario del Modal
    protected formPeriodos = signal<any[]>([]);

    ngOnInit(): void {
        this.loadUserMatches();
    }

    loadUserMatches() {
        const userId = this.authService.currentUser()?.idPlayer;
        this.matchesService.getMatchesByUser(userId).subscribe(res => {
            this.myMatches.set(res.userMatches); // Ajusta según la estructura real de tu respuesta
        });
    }

    // 🚀 Al abrir el modal, el partido ya trae su estructura desde la BBDD
    
    onLeagueFilterChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.selectedLeague.set(target.value);
    }

    // Enviar los datos editados al servidor
    saveResult() {
        const matchId = this.selectedMatch().IDMatch;
        
        // 🧠 REGLA DE ORO: Solo mandamos los periodos que el usuario ha rellenado.
        // El backend se encargará de ejecutar la fórmula de Excel para calcular los totales.
        const payload = {
            periodos: this.formPeriodos()
        };

        /*this.matchesService.updateResult(matchId, payload).subscribe({
            next: (res: any) => {
                this.notificationService.show(res.message, 'success');
                this.closeModal();
                this.loadUserMatches(); // Recarga la cuadrícula con el nuevo marcador global
            },
            error: (err) => this.notificationService.show(err.message, 'error')
        });*/
    }
}
