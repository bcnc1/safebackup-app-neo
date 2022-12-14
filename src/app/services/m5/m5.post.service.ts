import {HttpClient, HttpEvent, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {M5Service} from './m5.service';

import {Member, M5Result, M5ResultPosts, M5ResultToken} from '../../models';
import {catchError, map, tap} from 'rxjs/operators';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import * as moment from 'moment';



@Injectable({
  providedIn: 'root'
})


export class M5PostService extends M5Service {

  private member;
  private username;

  constructor(
    protected http: HttpClient,
    @Inject(LOCAL_STORAGE) private storage: StorageService) {
    super();
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  POST List
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  private handleResponse(response: any) {
    console.log('handleResponse = ' ,response);
    this.handleData(response);
    return response || {};
  }

  private handleTokenResponse(response: any) {
    console.log('handleTokenResponse = ' ,response);
    var token = response.token;
    console.log('token = ',token)
    return token || {};
  }

  // list(username: string, parameters: any): Observable<M5ResultPosts> {
  //   const url = this.url.list(username);
  //   this.member = this.storage.get('member');
  //   //this.username = this.

  //   const httpOptions = {
  //     headers: new HttpHeaders({
  //       'X-Auth-Token':  this.member.token
  //     })
  //   };

  //   parameters.accessToken = this.storage.get('accessToken');
  //   const params = this.getFormUrlEncoded(parameters);


  //   const url = this.url.boards(boardId) + '/my/posts?' + params;
  //   console.log('PARAMS', url);
  //   return this.http.get<string>(url, {})
  //     .pipe(
  //       map(res => this.handleResponse(res)),
  //       catchError(this.handleError)
  //     );

  // }


  
  save(boardId, post, parameters): Observable<M5Result> {

    let params = Object.assign(post, parameters);
    params.accessToken = this.storage.get('accessToken');
    params = this.getFormUrlEncoded(params);

    const url = this.url.boards(boardId) + '/posts?' + params;

    console.log('SAVEVPOST.URL', url);
    return this.http.post(url,
      {})
      .pipe(
        map(res => this.handleResponse(res)),
        catchError(this.handleError)
      );
  }


  delete(postId, parameters): Observable<M5Result> {

    let params = parameters;
    params.accessToken = this.storage.get('accessToken');
    params = this.getFormUrlEncoded(params);

    const url = this.url.posts(postId) + '?' + params;

    console.log('DELETEPOST.URL', url);
    return this.http.delete(url,
      {})
      .pipe(
        map(res => this.handleResponse(res)),
        catchError(this.handleError)
      );
  }


  createProof(postUrl, member, filepath, index, noti): Observable<M5Result> {

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Auth-Token': member.token });
    let options = { headers: headers };

    let body = {'id': member.username , 'file': decodeURI(filepath)}

    const url = postUrl;

    console.log('createProof', url);
    return this.http.post(url,
      body, options)
      .pipe(
        map(res => this.handleResponse(res)),
        catchError(this.handleError)
      );
  }

  getNewToken(postUrl, member): Observable<M5Result> {
    console.log('88.. ?????? = ', member);
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'});
    let options = { headers: headers , json: true};

    let body = {'id': member.username , 'pwd': member.password}

    const url = postUrl;

    console.log('getNewToken', url);
    return this.http.post(url,
      body, options)
      .pipe(
        map(res => this.handleTokenResponse(res)),
        catchError(this.handleError)
      );
  }

  updateProof(postUrl, member, filepath, index, noti): Observable<M5Result> {

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Auth-Token': member.token });
    let options = { headers: headers };

    let body = {'id': member.username , 'file': decodeURI(filepath)}

    const url = postUrl;

    console.log('updateProof', url);
    return this.http.put(url,
      body, options)
      .pipe(
        map(res => this.handleResponse(res)),
        catchError(this.handleError)
      );
  }
}


