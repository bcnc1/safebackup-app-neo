import {HttpClient, HttpEvent, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Inject, Injectable} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {M5Service} from './m5.service';
import {ElectronService} from 'ngx-electron';
import {Member, M5Result, M5ResultMember, Urgent} from '../../models';
import {catchError, map, tap} from 'rxjs/operators';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import * as moment from 'moment';
import {environment} from '../../../environments/environment';


const request = require('request');
const log = require('electron-log');

@Injectable({
  providedIn: 'root'
})

export class M5MemberService extends M5Service {

  private chainUpdate =  false;

  constructor(
    protected http: HttpClient,
    public electronService: ElectronService,
    @Inject(LOCAL_STORAGE) private storage: StorageService) {
    super();
  }

 

  public isLoggedin() {
    //console.log('isLoggedin =>  맴버 ', this.storage.get('member'));
    return this.storage.get('member');
  }

  public isChainUpdate(){
    return this.chainUpdate;
  }

  // private setChianUpdate(set){
  //   this.chainUpdate =  set;
  // }
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
    this.storage.remove('login');
    //this.storage.remove('password'); 패스워드 없애면 죽음 왜 안지울까?

  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  로그인
   *
   *  username
   *  password
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
   initialize(username, password) {
    // Setting URL and headers for request
    var options = {
        uri: M5MemberService.login,
        method: 'POST',
         headers: {
          'Content-Type': 'application/json'
        },
        body:{
          id:username,
          pwd:password,
          client: M5MemberService.safebackupVersion
        },
        json : true
    };
    // Return new promise 
    return new Promise(function(resolve, reject) {
        request.post(options, function(err, resp, body) {
            if (err) {
              console.log('m5.member.11..로그인실패');
                reject(err);
            } else {
                if(resp.statusCode == 200){
                 //resolve(body.token);
                 var result = [];
                 result.push(body.token);
                 result.push(body.private);
                 result.push(body.noticeurgent);
                 result.push(body.nobackupdays);
                 resolve(result);
                }else{
                  console.log('m5.member..22..로그인실패');
                  reject(resp.headers);
                }
            }
        });
    });

}

public getLoginToken(member,storage , callback) {
  var initializePromise = this.initialize(member.username, member.password);

    initializePromise.then(function(result) {
       log.info('getLoginToken => result : ',result);
        var userToken = result[0];
        member.token = userToken;
        member.private = result[1];
        member.noticeurgent = result[2];
        member.nobackupdays = result[3];

        storage.set('member',member);
        callback(true);
    }, function(err) {
        log.error('토큰을 못 가지고 옴, => ',err);
        callback(false);
        //kimcy: 다 지우는게 맞나?
        //storage.remove(member);
    })
}

private initUrgentNotice(member){
  var options = { 
    uri: M5MemberService.urgentGet,
    method: 'GET',
     headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': member.token
    },
    json : true
  };

  return new Promise(function (resolve, reject){
    request.get(options, function(err, resp, body){
        if(err){
          reject(err);
        } else{
          if(resp.statusCode == 200){
            var result = [];
            result.push(body.title);
            result.push(body.message);
            result.push(body.url);
            log.info('initUrgentNotice => ', result);
            resolve(result);
          }else{
            reject(resp.headers);
          }
        }
    });
  });
}

public getUrgentNotice(member,storage, callback) {
  let urgent = this.initUrgentNotice(member);

    urgent.then(function(result) {
       var urgent = new Urgent();
        urgent.title = result[0];
        urgent.message = result[1];
        urgent.url = result[2];


        log.info('urgent success ',urgent);
        storage.set('urgent',urgent);
        callback(true);

    }, function(err) {
        log.error('urgent fail ',err);
        //return 1;
        callback(false);
    })
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

    return this.http.get(this.url.members(member.username) + '?' + params)
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
