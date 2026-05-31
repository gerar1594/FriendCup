import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { App } from '../../app';

@Injectable({
    providedIn: 'root',
})
export class SportsService {
    private http = inject(HttpClient);
    private API_URL = App.API_URI + '/sport';

    getSportResultadoFormat(sportId: any) {
        return this.http.get<any>(`${this.API_URL}/format/${sportId}`);
    }

    getSport(){
        return this.http.get<any>(`${this.API_URL}/get`);

    }
}
