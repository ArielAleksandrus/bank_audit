import { environment } from '../../../environments/environment';

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { AuthService } from './auth.service';
import { UrlEncoder } from '../helpers/url-encoder';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private router: Router, private http: HttpClient, private auth: AuthService) {  }

  customAuth?: HttpHeaders;
  disabledApiPath: boolean = false;

  noAuth() {
    this.setAuth({});
  }
  enableAuth() {
    this.setAuth(null);
  }
  
  /**
   * A way to add another user's authorization to a request
   * For example: an admin authorizing a balance of a cashier
   * to be 'closed'.
   * @param {{}} auth_headers Key-Values of authorization headers
   */
  setAuth(auth_headers: any): ApiService {
    if(auth_headers == null){
      //@ts-ignore
      this.customAuth = null;
    } else
      this.customAuth = new HttpHeaders(auth_headers);
    return this;
  }

  disableApiPath() {
    this.disabledApiPath = true;
  }
  enableApiPath() {
    this.disabledApiPath = false;
  }


  req(resource_plural: string, toSend: {} = {}, route: { member?: {id: number | string, value: string}, collection?: string} = {}, method: 'get'|'post'|'patch'|'delete' = 'get', additionalHeaders: {} = {}): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}`;
    if(!!route.member)
      url += `/${route.member.id}/${route.member.value}`;
    if(!!route.collection)
      url += `/${route.collection}`;

    let headers: HttpHeaders = self._getAuthHeaders();
    for(let key in additionalHeaders) {
      //@ts-ignore
      headers.set(key, additionalHeaders[key]);
    }
    headers.set('ngrok-skip-browser-warning', '1');

    let request = null;

    switch(method) {
      case "get": {
        url += self.encodeParams(toSend);
        request = self.http.get<any>(url, {
          headers: headers
        });
        break;
      }
      case "delete": {
        url += self.encodeParams(toSend);
        request = self.http.delete<any>(url, {
          headers: headers
        });
        break;
      }
      case "patch": {
        request = self.http.patch<any>(url, toSend, {
          headers: headers
        });
        break;
      }
      case "post": {
        request = self.http.post<any>(url, toSend, {
          headers: headers
        });
        break;
      }
    }
    return request.pipe(
      catchError(self.handleError('index', resource_plural, toSend, []))
    );
  }

  index(resource_plural: string, query_params: {} = {}, route: { member?: {id: number | string, value: string}, collection?: string} = {}): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}`;
    if(!!route.member)
      url += `/${route.member.id}/${route.member.value}`;
    if(!!route.collection)
      url += `/${route.collection}`;
    
    url += self.encodeParams(query_params);
    return self.http.get<any>(url, {
      headers: self._getAuthHeaders()
    }).pipe(
      catchError(self.handleError('index', resource_plural, query_params, []))
    );
  }

  indexAll(resource_plural: string, query_params: any = {}, route: { member?: {id: number | string, value: string}, collection?: string} = {}, page = 1, finalResult: any = {}): Observable<any> {
    let self = this;

    query_params.page = page;
    query_params.per_page = 100;

    return new Observable((observer: any) => self.index(resource_plural, query_params, route).subscribe(
        (res: any) => {
          if(JSON.stringify(finalResult) == "{}")
            finalResult = res;
          else
            finalResult[resource_plural] = finalResult[resource_plural].concat(res[resource_plural]);

          if(res.total > 100 * page) {
            self.indexAll(resource_plural, query_params, route, page + 1, finalResult).subscribe(
              (res2: any) => {
                observer.next(res2);
              },
              (err2: any) => {
                observer.error(err2);
              }
            );
          } else {
            observer.next(finalResult);
            observer.complete();
          }
        },
        (err: any) => {
          observer.error(err);
        }
      )
    )
  }

  show(resource_plural: string, id: number | string, params: {} = {}, route: { member?: {id: number | string, value: string}, collection?: string} = {}, onError?: Function): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}/${id}`;
    if(!!route.member)
      url += `/${route.member.id}/${route.member.value}`;
    if(!!route.collection)
      url += `/${route.collection}`;

    url += self.encodeParams(params);
    return self.http.get(url, {
      headers: self._getAuthHeaders()
    }).pipe(
      catchError(self.handleError('show', resource_plural, params, [], onError))
    );
  }

  create(resource_plural: string, toSend: any): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}`;

    return self.http.post<any>(url, toSend, {
      headers: self._getAuthHeaders()
    }).pipe(
      catchError(self.handleError('create', resource_plural, toSend, []))
    );
  }

  update(resource_plural: string, id: string | number, toSend: any): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}/${id}`;

    return self.http.patch<any>(url, toSend, {
      headers: self._getAuthHeaders()
    }).pipe(
      catchError(self.handleError('create', resource_plural, toSend, []))
    );
  }

  destroy(resource_plural: string, id: string | number, params: any = {}): Observable<any> {
    let self = this;

    let url = self.getTargetUrl() + `/${resource_plural}/${id}`;
    url += self.encodeParams(params);

    return self.http.delete<any>(url, {
      headers: self._getAuthHeaders(),
      params: params
    }).pipe(
      catchError(self.handleError('destroy', `${resource_plural}/${id}`, params, []))
    );
  }

  getTargetUrl(): string {
    if(this.disabledApiPath)
      return environment.server_url;
    else
      return environment.server_url + environment.api_url;
  }
  
  ////////////////////////////////////////////////////////////////////

  private handleError<T>(func_name: string, resource_name: string, params: any = {}, result?: T, onError?: Function) {
    let self = this;

    return (error: any): Observable<T> => {

      console.log(`${func_name} -> Resource ${resource_name} failed: ${error.message}`);
      if(error.status === 0) {
        let error_count = Number(sessionStorage.getItem('error_zero') || '0');

        if(error_count > 2) {
          this.router.navigateByUrl('erro');
        } else {
          sessionStorage.setItem('error_zero', (error_count + 1).toString());
        }
        
      }
      if(error.status === 401) {
        this.router.navigateByUrl('login');
      }
      if(error.status === 403) {
        this.router.navigateByUrl('access-denied');
      }

      if(!!onError) {
        onError(error);
      }
      throw error;
    };
  }
  private encodeParams(params: {}): string {
    let str = "";
    if(Object.keys(params).length > 0 && params.constructor === Object){
      str += "?" + UrlEncoder.encode(params);
    }
    return str;
  }
  private _getAuthHeaders(): HttpHeaders {
    let headers: HttpHeaders;
    if(!!this.customAuth) {
      headers = this.customAuth;
      // unset customAuth because customAuth can be
      // a one-time-only admin authorization to a user action.
    } else {
      headers = this.auth.getAuthHeaders();
    }

    return headers;
  }
}
