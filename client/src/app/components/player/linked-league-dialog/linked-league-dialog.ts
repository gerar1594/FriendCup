import { Component, inject, input, model, output, signal } from '@angular/core';
import { LeaguesService } from '../../../services/leagues/leagues-service.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
    selector: 'app-linked-league-dialog',
    imports: [],
    templateUrl: './linked-league-dialog.html',
    styleUrl: './linked-league-dialog.scss',
})
export class LinkedLeagueDialog {

    showJoinDialog = model<boolean>(false);

    league = input.required<any>();
    unClaimedPlayers = input.required<any[]>(); // Lista de jugadores sin reclamar
    onLinked = output<void>();

    leaguesService = inject(LeaguesService);
    authService = inject(AuthService);



    // 4. Lógica para reclamar un perfil existente
    onClaimProfile(unclaimedPlayer: any) {
        if (confirm(`¿Confirmas que eres ${unclaimedPlayer.NamePlayerLeague}? Esta acción unirá tu cuenta a este historial.`)) {
            
            // Llamada al backend para hacer el link
            // El backend debe hacer: UPDATE leagueplayer SET IDPlayer = [Mi_ID_Usuario] WHERE IDLeaguePlayer = unclaimedPlayer.IDLeaguePlayer
            this.leaguesService.joinLeague({InvitationCode: this.league().InvitationCode, IDLeaguePlayer: unclaimedPlayer.IDLeaguePlayer, IDPlayer: this.authService.currentUser().IDPlayer}).subscribe({
                next: (res) => {
                    this.showJoinDialog.set(false);
                    this.onLinked.emit(); // Emite el evento de enlace
                },
                error: (err) => {
                    console.error('Error al reclamar perfil', err);
                    alert('Hubo un problema al enlazar el perfil.');
                }
            });
        }
            /*this.leagueService.claimLeagueProfile(unclaimedPlayer.IDLeaguePlayer).subscribe({
            next: (res) => {
                this.showJoinDialog.set(false);
                this.loadLeagueData(); // Recarga los datos (isPlayer() pasará a ser true automáticamente)
            },
            error: (err) => {
                console.error('Error al reclamar perfil', err);
                alert('Hubo un problema al enlazar el perfil.');
            }
        });*/
    }
}

