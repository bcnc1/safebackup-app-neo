import {HttpClient, HttpEvent, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {M5Service} from './m5.service';

import {Member, M5Result, M5ResultPosts} from '../../models';
import {catchError, map, tap} from 'rxjs/operators';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import * as moment from 'moment';


@Injectable({
  providedIn: 'root'
})


export class M5PostService extends M5Service {

  constructor(
    protected http: HttpClient,
    @Inject(LOCAL_STORAGE) private storage: StorageService) {
    super();
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  POST List
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  private handleResponse(response: any) {
    console.log(response);
    this.handleData(response);
    return response || {};
  }


  list(boardId: string, parameters: any): Observable<M5ResultPosts> {
    parameters.accessToken = this.storage.get('accessToken');
    const params = this.getFormUrlEncoded(parameters);


    const url = this.url.boards(boardId) + '/my/posts?' + params;
    console.log('PARAMS', url);
    return this.http.get<string>(url, {})
      .pipe(
        map(res => this.handleResponse(res)),
        catchError(this.handleError)
      );
  }


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
}
