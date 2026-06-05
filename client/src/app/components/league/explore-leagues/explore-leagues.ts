import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
  selector: 'app-explore-leagues',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './explore-leagues.html'
})
export class ExploreLeagues implements OnInit {
    private route = inject(ActivatedRoute);
    private leaguesService = inject(LeaguesService);
    private notifService = inject(NotificationService);
    

    // Signals para manejar el estado reactivo de la pantalla
    public searchTerms = signal<string>('');
    public leaguesResults = signal<any[]>([]);
    public isLoading = signal<boolean>(false);

    ngOnInit(): void {
        // Escuchamos los cambios en los queryParams de la URL (?search=...)
        this.route.queryParams.subscribe(params => {
            const query = params['search'];
            if (query) {
                this.searchTerms.set(query);
                this.fetchLeagues(query);
            } else {
                this.leaguesResults.set([]);
            }
        });
    }

    private fetchLeagues(query: string): void {
        this.isLoading.set(true);
        this.leaguesService.searchLeagues(query).subscribe({
            next: (res: any[]) => {
                this.leaguesResults.set(res);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error("Error al buscar ligas:", err);
                this.isLoading.set(false);
            }
        });
    }

    // Método interactivo del corazón clonado del que ya tienes en el detalle
    toggleFavorite(league: any): void {
        const nuevoEstado = league.IsFavorite ? 0 : 1;

        // Actualización optimista en el cliente
        this.leaguesResults.update(leagues =>
            leagues.map(l => l.IDLeague === league.IDLeague ? { ...l, IsFavorite: nuevoEstado } : l)
        );
        if(nuevoEstado){
            this.leaguesService.addLike(league.IDLeague).subscribe({
                next: (res) => {
                    console.log(res.message || "Favorito sincronizado en el servidor");
                    this.notifService.show(res.message, 'success');
                    this.leaguesResults.update(leagues =>
                        leagues.map(l => l.IDLeague === league.IDLeague ? { ...l, IsFavorite: !league.IsFavorite } : l)
                    );
                    this.leaguesService.triggerRefresh();
                },
                error: (err) => {
                    console.error("Error al guardar favorito, revirtiendo estado...", err);
                }
            });
        }else{
            this.leaguesService.deleteLike(league.IDLeague).subscribe({
                next: (res) => {
                    console.log(res.message || "Favorito sincronizado en el servidor");
                    this.notifService.show(res.message, 'success');
                    this.leaguesResults.update(leagues =>
                        leagues.map(l => l.IDLeague === league.IDLeague ? { ...l, IsFavorite: !league.IsFavorite } : l)
                    );
                    this.leaguesService.triggerRefresh();
                },
                error: (err) => {
                    console.error("Error al guardar favorito, revirtiendo estado...", err);
                }
            });
        }
        
    }
}