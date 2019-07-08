import {Component, Inject, NgZone, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {M5MemberService} from '../../services/m5/m5.member.service';
import {NotifierService} from 'angular-notifier';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ElectronService} from 'ngx-electron';
import {M5PostService} from '../../services/m5/m5.post.service';
import {UploadFiletreeService} from '../../services/upload.filetree.service';
import * as path from 'path';
import {KonsoleService} from '../../services/konsole.service';
import {Subscription} from 'rxjs';
import {NGXLogger} from 'ngx-logger';


@Component({
  selector: 'app-log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.scss']
})


export class LogComponent implements OnInit, OnDestroy {

  public logs = [];
  private progress = 0;
  public subscription: Subscription;

  constructor(
    private konsoleService: KonsoleService,
    private logger: NGXLogger,
    private zone: NgZone
  ) {

  }


  ngOnDestroy() {
    if (this.subscription != null) {
      this.subscription.unsubscribe();
    }
  }


  ngOnInit() {
    this.logger.debug('LOG COMPONENT', this.subscription);
    this.subscription = this.konsoleService.getMessage().subscribe(message => {

      this.zone.run(() => {
        if (message.cmd === 'SENDING.PROGRESS') {
          this.progress = parseInt(message.message);
        } else if (message.cmd === 'SENDING.STARTED') {
          this.progress = 0.0;
          this.logs.unshift({
              cmd: message.cmd,
              created: new Date(),
              message: message.message
            }
          );
        } else {
          this.logs.unshift({
              cmd: message.cmd,
              created: new Date(),
              message: message.message
            }
          );
        }

      });
    });
    this.logs.unshift({created: new Date(), message: '안심백업이 시작됩니다...'});
  }


}
