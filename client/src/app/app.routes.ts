import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { LeaguesManagementComponent } from './components/league/leagues-management/leagues-management';
import { League } from './components/league/league/league';
import { MyMatches } from './components/match/my-matches/my-matches';
import { InviteLeagueHandler } from './components/league/invite-league-handler/invite-league-handler';
import { ExploreLeagues } from './components/league/explore-leagues/explore-leagues';

export const routes: Routes = [
    { path: 'login', component: AuthComponent },


    { path: 'leagues/manage', component: LeaguesManagementComponent },
    { path: 'leagues', component: ExploreLeagues },

    { path: 'league/:id', component: League },

    { path: 'my-matches', component: MyMatches },
    { path: 'invite/:code', component: InviteLeagueHandler },


    { path: '', redirectTo: '/leagues/manage', pathMatch: 'full' }, // Opcional: Redirigir al login por defecto si no hay ruta
];
