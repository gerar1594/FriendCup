import { Component, DOCUMENT, Inject, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from "./components/navbar/navbar";
import { LeaguesService } from './services/leagues/leagues-service.service';
import { AuthService } from './services/auth/auth.service';
import { Toast } from "./components/toast/toast";
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, Navbar, Toast],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App implements OnInit {
    protected readonly title = signal('client');
    private leaguesService = inject(LeaguesService);
    authService = inject(AuthService);
    
    constructor(@Inject(DOCUMENT) private document: Document) {}

    ngOnInit() {
        // 🚀 Cargamos las ligas aquí para que estén listas en toda la aplicación
        const userId = this.authService.currentUser()?.idPlayer;

        this.leaguesService.loadUserOrAdminLeagues(userId);
        this.setFavicon();
    }

    setFavicon(): void {
        // Busca el elemento link del favicon en el index.html
        const favicon = this.document.getElementById('app-favicon') as HTMLLinkElement;
        
        if (favicon) {
        // Asigna la ruta definida en el environment actual
        favicon.href = environment.favicon;
        }
    }
}
