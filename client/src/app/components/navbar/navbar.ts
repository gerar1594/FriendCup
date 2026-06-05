import { Component, inject, OnInit, signal } from '@angular/core';
import { LeaguesService } from '../../services/leagues/leagues-service.service';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-navbar',
    imports: [CommonModule, RouterModule],
    templateUrl: './navbar.html',
    styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {

    public leaguesService = inject(LeaguesService);
    public authService = inject(AuthService);
    private router = inject(Router);

    isMobileMenuOpen = signal<boolean>(false);

    toggleMobileMenu() {
        this.isMobileMenuOpen.update(state => !state);
    }

    ngOnInit(): void {
    }
    onSearchLeague(event: Event) {
        const input = event.target as HTMLInputElement;
        const query = input.value.trim();

        if (query) {
            // Redirige a la pantalla de explorar ligas llevando el término de búsqueda
            this.router.navigate(['/leagues'], { queryParams: { search: query } });
            
            // Opcional: Limpiar el input después de buscar
            input.value = '';
        }
    }

}
