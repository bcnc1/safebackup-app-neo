import {HttpClient, HttpEvent, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {M5Service} from './m5.service';

import {Member, M5Result, M5ResultMember} from '../../models';
import {catchError, map, tap} from 'rxjs/operators';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import * as moment from 'moment';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class M5MemberService extends M5Service {

  constructor(
    protected http: HttpClient,
    @Inject(LOCAL_STORAGE) private storage: StorageService) {
    super();
  }

  public getLoggedin() {
    return this.storage.get('member');
  }

  public isLoggedin() {
    return this.storage.get('member');
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  로그아웃
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  public logout() {
    console.log('logout');
    this.storage.remove('member');
    this.storage.remove('board');
    this.storage.remove('accessToken');
    //kimcy add
    this.storage.remove('username');
    this.storage.remove('userToken');  //추후 삭제 안할수도..
    //this.storage.remove('password'); 패스워드 없애면 죽음 왜 안지울까?

  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  로그인
   *
   *  username
   *  password
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
   private getLoginToken(response: any) {
    console.log('응답 : ',response.headers);
    if(response.statusCode == 200){
      var userToken = response.headers['x-auth-token'];
      this.storage.set('userToken', userToken);
    }
     //this.handleData(response);
    // this.storage.set('member', response.member);
    // this.storage.set('accessToken', decodeURIComponent(response.accessToken));
    // if (response.orgBoards != null) {
    //   response.orgBoards.forEach(board => {
    //     console.log(board);
    //     if (board.type === 'board') {
    //       this.storage.set('board', board);
    //     }
    //   });
    // } else {
    //   this.storage.set('board', {
    //     id: 'SVCBoard_481477478793500'
    //   });
    // }

    return response || {};

  }

  private handleLoginResponse(response: any) {
    console.log('로그인 : ',response);
    this.handleData(response);
    this.storage.set('member', response.member);
    this.storage.set('accessToken', decodeURIComponent(response.accessToken));
    if (response.orgBoards != null) {
      response.orgBoards.forEach(board => {
        console.log(board);
        if (board.type === 'board') {
          this.storage.set('board', board);
        }
      });
    } else {
      this.storage.set('board', {
        id: 'SVCBoard_481477478793500'
      });
    }

    return response || {};

  }

  
  //자체 서버가 필요없음으로 삭제해야 될 부분
  public login(member: Member): Observable<M5ResultMember> {

    console.log('LOGIN : ', member);
    const body = ObjectUtils.copy(member);
    body.fetchOrgBoards = true;
    return this.http.post(this.url.login(), body)
      .pipe(
        map(res => this.handleLoginResponse(res)),
        catchError(this.handleError)
      );
  }

  public loginB(username, password){
    console.log('loginB', username);
    const options = {
      headers :{
        'X-Auth-New-Token': 'true',
        'x-storage-user': 'doctorkeeper:'+username,
        'x-storage-pass': password
      }
    }
    return this.http.get(environment.AUTH_URL, options)
      .pipe(
        map(res => this.getLoginToken(res)),
        //this.getLoginToken(res),
        catchError(this.handleError)
      );
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  사용자 등록
   *
   *  username
   *  password
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  private handleSignupResponse(response: any) {
    console.log('사용자등록');
    this.handleData(response);
    this.storage.set('member', response.member);
    this.storage.set('accessToken', decodeURIComponent(response.accessToken));
    this.storage.set('board', {
      id: 'SVCBoard_481477478793500'
    });
    return response.member || {};
  }


  public signup(member: Member): Observable<M5Result> {

    console.log('m5.member.service-> signup');
    const formData = new FormData();
    formData.append('username', member.username);
    formData.append('password', member.password);
    formData.append('fullname', member.fullname);
    formData.append('fetchOrgBoards', 'true');


    const params = this.getFormUrlEncoded({
      username: member.username,
      password: member.password,
      fullname: member.fullname,
      level: 'USER',
      fetchOrgBoards: true
    });

    return this.http.post(this.url.signup() + '?' + params,
      {})
      .pipe(
        map(res => this.handleSignupResponse(res)),
        catchError(this.handleError)
      );
  }


  private handleMemberDetailResponse(response: any) {
    console.log('>>> handleMemberDetailResponse', response);
    return response;
  }

  private handleUserDataResponse(response: any) {
    console.log('>>> handleUserDataResponse', response);
    return response;
  }

  public detail(member): Observable<M5ResultMember> {

    const params = this.getFormUrlEncoded({
      accessToken: this.storage.get('accessToken')
    });

    return this.http.get(this.url.members(member.id) + '?' + params)
      .pipe(
        map(res => this.handleMemberDetailResponse(res)),
        catchError(this.handleError)
      );
  }

  public updateFolderData(folderItem, member): Observable<M5Result> {
    if (member === undefined) {
      return;
    }
    const formData = new FormData();
    let userData = member.userData;
    if (userData === undefined) {
      userData = {};
    }

    userData.lastZip = folderItem.lastZip;
    userData.lastUploaded = folderItem.lastUploaded;
    userData.version = environment.VERSION;
    if (userData.pcs === undefined) {
      userData.pcs = {};
    }
    if (folderItem.deviceResource == null) {
      folderItem.deviceResource = {
        macaddress: 'MAC'
      };
    }
    if (userData.pcs[folderItem.deviceResource.macaddress] === undefined) {
      userData.pcs[folderItem.deviceResource.macaddress] = {};
    }
    userData.pcs[folderItem.deviceResource.macaddress].resource = folderItem.deviceResource;
    if (userData.pcs[folderItem.deviceResource.macaddress].folders === undefined) {
      userData.pcs[folderItem.deviceResource.macaddress].folders = {};
    }
    userData.pcs[folderItem.deviceResource.macaddress].folders[folderItem.path] = {
      size: folderItem.count,
      folderName: folderItem.path.replace(/\\/g, '/'),
      error: folderItem.error,
      updated: moment().unix()
    };


    console.log('***UPDATEFOLDERDATA.MEMBER', folderItem);


    const params = this.getFormUrlEncoded({
      userData: JSON.stringify(userData),
      accessToken: this.storage.get('accessToken')
    });

    const url = this.url.members(member.id) + '/userData?' + params;
    console.log('UPDATEFOLDERDATA.URL', url);
    return this.http.post(url,
      {})
      .pipe(
        map(res => this.handleUserDataResponse(res)),
        catchError(this.handleError)
      );

  }
}
