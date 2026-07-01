import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root',
})
export class PlayerService {
    private http = inject(HttpClient);
    private API_URL = environment.apiUri + '/player';


    
    getAnonimo() {
        return this.http.get<any>(`${this.API_URL}/anonimo`);
    }

    getHomeData() {
        return this.http.get<any>(`${this.API_URL}/home`);
    }
}
