import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginUser } from './login.schema';

const BASEURL = "http://127.0.0.1:5000";


@Injectable({
    providedIn: 'root'
})
export class LoginDataService {
    url!: string;
    headers: any = {
        "Content-Type": "application/json"
    }

    constructor(private http: HttpClient) { 
        this.url = BASEURL + '/api';
    }

    getUsers(): Observable<LoginUser[]> {
        return this.http.get<LoginUser[]>(this.url + '/users/list');
    }

    createUser(userFormData: LoginUser) {
        return this.http.post<LoginUser[]>(this.url + '/users/create', userFormData, { headers: this.headers });
    }
}