import {Component, Inject, OnInit} from '@angular/core';
import {M5MemberService} from '../../services/m5/m5.member.service';
import {Router} from '@angular/router';
import {Member} from '../../models';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {M5PostService} from '../../services/m5/m5.post.service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import {NGXLogger} from 'ngx-logger';

const request = require('request');
const reqestProm = require('request-promise-native');
const {dialog} = require('electron').remote;
const log = require('electron-log');

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss']
})


export class LoginPageComponent implements OnInit {

  public username;
  public password;
  public loggingin;

  private passwords;
  private passwordIndex = 0;
  private oldPaths = new Array(2);
  private migrateFromV1 = false;
  public migrating = false;
  private member;
  //public userToken;

  

  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private logger: NGXLogger,
    private router: Router,
   // private userToken : string,
    

    @Inject(LOCAL_STORAGE) private storageService: StorageService) {
  }

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
          // Do async job
           // request.get(options, function(err, resp, body) {
            request.post(options, function(err, resp, body) {
                if (err) {
                  console.log('11..로그인실패');
                    reject(err);
                } else {
                    if(resp.statusCode == 200){
                      var result = [];
                      result.push(body.token);
                      result.push(body.private);
                     console.log('login result = ',result);
                     resolve(result);
                    }else{
                      console.log('22..로그인실패');
                      reject(resp.headers);
                    }
                }
            });
        });

    }
    
    onLoginB(member, popup, storage, router){
      var initializePromise = this.initialize(member.username, member.password);

      initializePromise.then(function(result) {
           var userToken = result[0];
           //console.log("userToken :",userToken);
           member.token = userToken;

          var userPrivate = result[1];
          member.private = userPrivate;
          //console.log('22..계정 = ',member.private);
          storage.set('member',member);
          storage.set('login',true);
          
          router.navigateByUrl('/home');


      }, function(err) {
          console.log(err);
          storage.remove(member);
          //kimcy:windows 릴리즈 모드에서 팝업뜬다음 에디트텍스트가 입력안되는 현상이 발생
          //alert('ID/패스워드를 확인하세요.');
          let options = {
            message: 'ID/패스워드를 확인하세요'
          }
          dialog.showMessageBox(options);
      })
    }




  onLogin(username, password  , popup) {
    console.log('onLogin 22');
    log.info('로그인 버튼 누름 , id =',username,'pw = ',password);

    //로그인하고 토큰 재활용은 추후에..kimcy
    const member = new Member();

    if (username == null && password == null) {
      member.username = this.username;
      member.password = this.password;
      popup = true;

      console.log('11..',this.username, this.password);
    } else {
      popup = false;
      member.username = username;
      member.password = password;
      console.log('22..',this.username, this.password);
    }

    //kimcy: 토큰은 여기서 넣어준다..
    this.onLoginB(member, false, this.storageService, this.router);
    
  }


  ngOnInit(): void {
    
    console.log('loginin ngOnInit, 여기가 시작인듯');
    this.loggingin = false;

    /*---------------------------------------------------------------
         이전 버전 (v1.0.xx) 인지 체크
     --------------------------------------------------------------*/
     console.log('login-page.component ');

    setTimeout(() => {
      // let username = localStorage.getItem('username');
      // let password = localStorage.getItem('password');
      this.member = this.memberAPI.isLoggedin();
      let username, password;

      if(this.member === undefined){
        console.log('처음실행 앱 안죽게');
        return;
      }else{
        username = this.member.username;
        password = this.member.password;
      }

      if (username != null && password != null) {

        username = username.replace(/"/g, '').replace(/"/g, '');
        password = password.replace(/"/g, '').replace(/"/g, '');

        console.log("11..oninit =>username :",username);
        console.log("11..oninit =>password :",password);
        // 이전버전은 삭제
        //this.migrating = true;
        //kimcy
        this.migrating = false;
        this.migrateFromV1 = true;
        this.username = username;
        // this.oldPaths[0] = localStorage.getItem('uploadPath[0]:' + username);
        // this.oldPaths[1] = localStorage.getItem('uploadPath[1]:' + username);

        this.onLogin(username, password, false);

      } else {
        const member = this.storageService.get('member');
        password = password.replace(/"/g, '').replace(/"/g, '');

        // console.log("22..oninit =>username :",username);
        // console.log("22..oninit =>password :",password);
        if (member != null && password != null) {
          this.username = member.username;
          this.onLogin(member.username, password, false);
        }
      }
    }, 1000);
  }

}
