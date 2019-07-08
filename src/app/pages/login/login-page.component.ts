import {Component, Inject, OnInit} from '@angular/core';
import {M5MemberService} from '../../services/m5/m5.member.service';
import {Router} from '@angular/router';
import {Member} from '../../models';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {M5PostService} from '../../services/m5/m5.post.service';
import {ObjectUtils} from '../../utils/ObjectUtils';
import {NGXLogger} from 'ngx-logger';


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

  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private logger: NGXLogger,
    private router: Router,
    @Inject(LOCAL_STORAGE) private storageService: StorageService) {
  }

  onLogin(username, password, popup) {
    console.log('===');

    if (this.storageService.get('member') != null) {
      this.router.navigateByUrl('/home');
      return;
    }
    const member = new Member();

    if (username == null && password == null) {
      member.username = this.username;
      member.password = this.password;
      popup = true;
    } else {
      popup = false;
      member.username = username;
      member.password = password;
    }


    this.loggingin = true;
    this.memberAPI.login(member).subscribe(
      response => {
        {
          this.loggingin = true;
          this.logger.debug('LOGIN', response);
          if (ObjectUtils.isNotEmpty(this.oldPaths[0])) {
            this.storageService.set('folder:' + response.member['id'] + ':' + 0, this.oldPaths[0]);
          }
          if (ObjectUtils.isNotEmpty(this.oldPaths[1])) {
            this.storageService.set('folder:' + response.member['id'] + ':' + 1, this.oldPaths[1]);
          }
          this.storageService.set('password', member.password);
          this.router.navigateByUrl('/home');
        }
      },
      error => {
        this.loggingin = true;
        if (error.code != null) {
          if (error.code === 1040) {
            const memberForm = new Member();
            memberForm.fullname = member.username;
            memberForm.username = member.username;
            memberForm.password = member.password;

            if (this.migrateFromV1) {
              this.memberAPI.signup(memberForm).subscribe(
                response => {
                  {
                    this.logger.debug('SIGNUP', response);
                    this.migrating = false;
                    this.onLogin(member.username, member.password, false);

                  }
                },
                signupError => {
                  if (signupError.code != null) {
                    this.migrating = false;
                    // alert(signupError.message);
                  } else {
                    this.migrating = false;
                    // alert(signupError);
                  }
                });
            } else {
              if (popup === true) {
                // alert('아이디를 확인하세요. 가입을 원하시면 관리자에게 연락하시기 바랍니다.');
              }
            }
          } else if (error.code === 1070) {
            if (popup === true) {
              // alert('비밀번호를 확인하세요.');
            }
          }
        } else if (error.message != null) {
          this.migrating = false;
          if (popup === true) {
            // alert(error.message);
          }
        } else {
          this.migrating = false;
          if (popup === true) {
            // alert(error);
          }
        }

        setTimeout(() => {
          // member.username = username;
          // member.password = this.passwords[this.passwordIndex % 2];
          // this.passwordIndex++;

          this.onLogin(member.username, member.password, false);
        }, 60 * 5 * 1000);
      }
    );
  }

  onSignup() {
    this.router.navigateByUrl('/signup');
  }

  ngOnInit(): void {

    this.loggingin = false;
    /*---------------------------------------------------------------
         이전 버전 (v1.0.xx) 인지 체크
     --------------------------------------------------------------*/


    setTimeout(() => {
      let username = localStorage.getItem('username');
      let password = localStorage.getItem('password');

      this.logger.debug('ONINIT', username, password);

      if (username != null && password != null) {

        username = username.replace(/"/g, '').replace(/"/g, '');
        password = password.replace(/"/g, '').replace(/"/g, '');

        // 이전버전은 삭제
        this.migrating = true;
        this.migrateFromV1 = true;
        this.username = username;
        this.oldPaths[0] = localStorage.getItem('uploadPath[0]:' + username);
        this.oldPaths[1] = localStorage.getItem('uploadPath[1]:' + username);

        this.storageService.remove('username');

        this.onLogin(username, password, false);


      } else {
        const member = this.storageService.get('member');
        password = password.replace(/"/g, '').replace(/"/g, '');

        if (member != null && password != null) {
          this.username = member.username;
          this.onLogin(member.username, password, false);
        }
      }
    }, 1000);
  }

}
