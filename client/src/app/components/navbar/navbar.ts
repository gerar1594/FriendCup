import { Component, inject, OnInit, signal } from '@angular/core';
import { LeaguesService } from '../../services/leagues/leagues-service.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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


    ngOnInit(): void {
    }

}
