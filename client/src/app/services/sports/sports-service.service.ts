import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { App } from '../../app';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root',
})
export class SportsService {
    private http = inject(HttpClient);
    private API_URL = environment.apiUri + '/sport';

    getSportResultadoFormat(sportId: any) {
        return this.http.get<any>(`${this.API_URL}/format/${sportId}`);
    }

    getSport(){
        return this.http.get<any>(`${this.API_URL}/get`);

    }
}
