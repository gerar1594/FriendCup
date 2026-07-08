import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';
import { AuthService } from '../../../services/auth/auth.service';
import { SportsService } from '../../../services/sports/sports-service.service';
import { NotificationService } from '../../../services/notification/notification.service';


@Component({
    selector: 'app-leagues-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './leagues-management.html',
    styleUrls: ['./leagues-management.scss']
})
export class LeaguesManagementComponent implements OnInit {
    private leaguesService = inject(LeaguesService);
    private authService = inject(AuthService);
    private sportService = inject(SportsService);
    private notificationService = inject(NotificationService);
    
    private router = inject(Router);

    idPlayer = signal<number | null>(null);

    sports = signal<any[]>([])

    // Modelos vinculados al HTML
    createData = { NameLeague: '', IDSport: '' };
    invitationCodeInput = '';
    constructor(){
        if(this.authService.currentUser() == null){
            this.router.navigate(['/login']);

        }
    }

    ngOnInit(): void {
        const user = this.authService.currentUser();
        // Ajustado para capturar tu IDPlayer del usuario logueado
        if (user && user.idPlayer) {
            this.idPlayer.set(user.idPlayer);
            this.leaguesService.triggerRefresh();
            this.sportService.getSport().subscribe({
                next:(res) => {
                    this.sports.set(res);
                },
                error:(err) => {

                }
            });

        } else {
            this.router.navigate(['/login']);
        }
    }

    onCreateLeague() {
        if (!this.createData.NameLeague || !this.createData.IDSport  || !this.idPlayer()) return;

        const payload = {
            NameLeague: this.createData.NameLeague,
            IDSport: this.createData.IDSport,
            IDPlayer: this.idPlayer()!
        };

        this.leaguesService.createLeague(payload).subscribe({
            next: (res) => {
                this.notificationService.show(`🏆 ¡Liga creada con éxito!\nComparte este código con tus amigos: ${res.code}`, 'success');

                this.leaguesService.triggerRefresh();

                this.router.navigate(['/league', res.idLeague]);
            },
            error: (err) =>{
                this.notificationService.show(err.message, 'error');
            }
        });
    }

    onJoinLeague() {
        if (!this.invitationCodeInput.trim() || !this.idPlayer()) return;

        const payload = {
            InvitationCode: this.invitationCodeInput.toUpperCase().trim(),
            IDPlayer: this.idPlayer()!
        };

        

    }
}