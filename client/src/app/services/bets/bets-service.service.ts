import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class BetsService {
    
    private http = inject(HttpClient);
    private API_URL = environment.apiUri + '/bets';

    saveMatchBet(payload: { idMatch: any, predictedBando: any}) : Observable<any> {
        return this.http.post(`${this.API_URL}/save-match`, payload);
    }
    saveLeagueBet(payload: {idLeague: any, predictedWinnerId: any}) : Observable<any>  {
        return this.http.post(`${this.API_URL}/save-league`, payload);
    }
}
