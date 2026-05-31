import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { App } from '../../app';

@Injectable({
    providedIn: 'root',
})
export class MatchesService {

    private http = inject(HttpClient);
    private API_URL = App.API_URI + '/match';

    getMatchesByUser(userId: any) {
        return this.http.get<any>(`${this.API_URL}/user/${userId}`);
    }
    getMatchByLeague(idLeague: any) {
        return this.http.get<any>(`${this.API_URL}/league/${idLeague}`);
    }
    updateResult(matchId: any, payload: { totalLocal?: number; totalVisitante?: number; periodos: any[]; }) {
        console.log(`${this.API_URL}/${matchId}`, payload) ;
        return this.http.put<any>(`${this.API_URL}/${matchId}/result`, payload);
    }
    validateMatch(matchId: any, payload: { idPlayer: any }) {
        console.log(`${this.API_URL}/${matchId}`, payload) ;
        return this.http.put<any>(`${this.API_URL}/${matchId}/validate`, payload);
    }
    validateMatchAdmin(matchId: any, payload: { idPlayer: any, periodos: any[] }) {
        console.log(`${this.API_URL}/${matchId}/admin`, payload) ;
        return this.http.put<any>(`${this.API_URL}/${matchId}/admin`, payload);
    }

}
