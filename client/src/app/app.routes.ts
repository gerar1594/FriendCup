import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { LeaguesManagementComponent } from './components/league/leagues-management/leagues-management';
import { League } from './components/league/league/league';
import { MyMatches } from './components/match/my-matches/my-matches';
import { InviteLeagueHandler } from './components/league/invite-league-handler/invite-league-handler';
import { ExploreLeagues } from './components/league/explore-leagues/explore-leagues';
import { Home } from './components/home/home/home';
import { authGuard, publicGuard } from './core/guards/auth-guard';

export const routes: Routes = [
    { path: 'login', component: AuthComponent, canActivate: [publicGuard] },


    { path: 'leagues/manage', component: LeaguesManagementComponent, canActivate: [authGuard] },
    { path: 'leagues', component: ExploreLeagues, canActivate: [authGuard] },

    { path: 'league/:id', component: League , canActivate: [authGuard]},

    { path: 'my-matches', component: MyMatches, canActivate: [authGuard] },
    { path: 'invite/:code', component: InviteLeagueHandler, canActivate: [authGuard] },
    { path: 'home', component: Home, canActivate: [authGuard] },


    { path: '', redirectTo: 'home', pathMatch: 'full'}, // Opcional: Redirigir al login por defecto si no hay ruta
    { path: '**', redirectTo: 'login' }
];
