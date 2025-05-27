import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { Observable, of } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';


export const AUTH_HEADERS = ["access-token", "token-type", "client", "expiry", "uid"];

@Injectable({ providedIn: 'root' })
export class AuthService {

  private loginUrl = environment.server_url + environment.api_url + "/auth/sign_in"  // URL to web api

  constructor(
    private http: HttpClient) { }

  checkCredentials(credentials: {nickname: string, password: string}) : Observable<HttpResponse<any>> {
    function handleTimeout(err: any, customStatus?: any): Observable<any> {
      if(err.constructor.name != "TimeoutError"){
        throw err;
      } else {
        if(!!customStatus) {
          err.status = customStatus;
        }
        throw {status: 0};
      }
    }

    return this.http.post<any>(this.loginUrl, credentials, {observe: 'response'}).pipe(
      timeout(15000),
      catchError((err: any) => handleTimeout(err, 0))
    );
  }

  setAuthKeyValues(keyValues: any): void {
    for(let key in keyValues)
      localStorage.setItem(key, keyValues[key]);
  }

  getAuthKeyValues(): any {
    let keyValues: any = {};

    for(let key of AUTH_HEADERS) {
      let value = localStorage.getItem(key);

      if(value == null) {
        throw new Error(`AuthService: Header '${key}' cannot be '${value}'`);
        return null;
      }

      keyValues[key] = value;
    }

    return keyValues;
  }

  getAuthHeaders(): HttpHeaders {
    return new HttpHeaders(this.getAuthKeyValues());
  }

  destroyAuthKeyValues(): void {
    for(let key of AUTH_HEADERS)
      localStorage.removeItem(key);
    localStorage.removeItem('current_user');
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  private handleError<T> (operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      console.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }
}