import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';
import { NotificationService } from '../../../services/notification/notification.service';

@Component({
  selector: 'app-invite-league-handler',
  imports: [],
  templateUrl: './invite-league-handler.html',
  styleUrl: './invite-league-handler.scss',
})
export class InviteLeagueHandler implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authService = inject(AuthService);
    private leagueService = inject(LeaguesService);
    private notificationService = inject(NotificationService);

    ngOnInit() {
        const code = this.route.snapshot.paramMap.get('code');
        
        if (!code) {
            this.router.navigate(['/dashboard']);
            return;
        }

        // 🕵️ MÁQUINA DE ESTADOS DEL LOGIN
        if (this.authService.isLoggedIn()) {
            // Caso A: El usuario ya está logueado -> Lo inscribimos directo
            this.inscribirUsuarioEnLiga(code);
        } else {
            // Caso B: No está logueado -> Guardamos el código de la liga y al login
            localStorage.setItem('pending_invite_code', code);
            this.router.navigate(['/login']);
        }
    }

    private inscribirUsuarioEnLiga(code: string) {
        this.leagueService.joinLeague({InvitationCode: code, IDPlayer: this.authService.currentUser().idPlayer}).subscribe({
            next: (res: any) => {
                // Redirigimos directamente a la vista de la liga usando su ID real devuelto por el back
                this.router.navigate(['/league', res.idLeague]);
            },
            error: (err) => {
                console.error('Error al unirse:', err);
                this.notificationService.show('No se pudo unir a la liga con el código proporcionado. Redirigiendo al dashboard.' + err.error?.message, 'error');
                this.router.navigate(['/leagues/manage']);
            }
        });
    }
}
