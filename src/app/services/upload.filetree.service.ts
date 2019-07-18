import {Inject, Injectable, OnDestroy, OnInit} from '@angular/core';
import {M5MemberService} from './m5/m5.member.service';
import {M5PostService} from './m5/m5.post.service';

import {ElectronService} from 'ngx-electron';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';

import * as path from 'path';
import * as moment from 'moment';
import {Observable, Subject, Subscription} from 'rxjs';
import {M5Service} from './m5/m5.service';
import {KonsoleService} from './konsole.service';
import {ObjectUtils} from '../utils/ObjectUtils';
import {NGXLogger} from 'ngx-logger';
import {BytesPipe} from 'angular-pipes';
import {environment} from '../../environments/environment';


@Injectable()
export class UploadFiletreeService {

  private folders;
  private subscription;
  private subject;
  private filesToSend;
  private folderIndex;
  private deviceResource;
  private board;
  private member;
  private accessToken;

  private uploading = false;
  private notification;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Constructor
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  fillFollders() {
    this.folders = new Array(4);


    for (let i = 0; i < 4; i++) {
      this.folders[i] = {
        path: this.storageService.get(this.getFolderKey(i))
      };
    }

  }

  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private electronService: ElectronService,
    private konsoleService: KonsoleService,
    private logger: NGXLogger,
    @Inject(LOCAL_STORAGE) private storageService: StorageService) {
    this.member = this.memberAPI.isLoggedin();

    this.fillFollders();
    this.board = this.storageService.get('board');
    this.accessToken = this.storageService.get('accessToken');

    this.notification = new Subject();
    this.subject = new Subject();
    this.subscription = this.subject.subscribe(response => this.processFile(response));

    /*----------------------------------------------------
     *  IPC Response : Get FileTree
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('PCRESOURCE', (event: Electron.IpcMessageEvent, response: any) => {
      this.deviceResource = response;
      console.log('PCRESOURCE deviceResource : ', this.deviceResource);
    });
    /*----------------------------------------------------
       *  IPC Response : Get FileTree
       ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('SENDING.PROGRESS', (event: Electron.IpcMessageEvent, response: any) => {

      this.notification.next({
        cmd: 'SENDING.PROGRESS',
        message: response.percent
      });
    });
    /*----------------------------------------------------
     *  IPC Response : Get FileTree
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any) => {
        const fileTree = response.tree;
        let folderSize = 0;
        this.folderIndex = response.folderIndex;
        this.filesToSend = [];
        console.log('44..앱이실행중이라 업로드 fileTree : ',fileTree);
        console.log(this.folderIndex);
        console.log(fileTree.length);
        //파일이 없으면?
        //if(typeof fileTree.length == 'undefined')
        if(fileTree.length == undefined){
          console.log('백업할 파일이 없음');
          this.notification.next({cmd: 'LOG', message: '백업할 파일이 없습니다.'});
          this.gotoNextFile(this.folderIndex);
          return; //이게 맞나?
        }

        
        fileTree.forEach(element => {
          folderSize += this.processTreeElement(this.folderIndex, element);

        });

        this.logger.debug('GETFOLDERTREE***********', folderSize);
        this.notification.next({
          cmd: 'FOLDER.INFO',
          folderData: {
            index: this.folderIndex,
            size: folderSize
          }
        });


        /*----------------------------------------------------
          *  이상있는 파일 체크
          ----------------------------------------------------*/
        let foundDataBackup = false;
        let zipFound = false;
        let minDiff = -1000;
        let maxDate = moment().year(1990).month(0).date(1);
        const fileSortList = [];
        const folderSortList = [];

        // 최근 5개 계산을 위한 정렬용 배열에 채워넣는다.
        for (const f in this.filesToSend) {
          if (this.filesToSend.hasOwnProperty(f)) {
            const fileItem = this.filesToSend[f];

            const folderName = path.dirname(fileItem.file.fullpath);
            const paths = folderName.split(path.sep);
            if (paths[paths.length - 1].toLowerCase().indexOf('data_backup') >= 0) {
              foundDataBackup = true;
              const filename = fileItem.file.filename;
              const fyyyy = Number(filename.substr(0, 4));
              const fmm = Number(filename.substr(4, 2));
              const fdd = Number(filename.substr(6, 2));
              const fdate = moment([fyyyy, fmm - 1, fdd]);
              console.log(fileItem);
              if (fdate.isValid()) {

                if (fileItem.file.type === 'file') {
                  if (filename.toLowerCase().indexOf('.zip') > 0) {
                    zipFound = true;
                    fileItem.sortDate = fdate;
                    fileSortList.push(fileItem);
                    if (maxDate.isBefore(fdate)) {
                      maxDate = fdate;
                    }
                  }
                } else if (fileItem.file.type === 'folder') {
                  fileItem.sortDate = fdate;
                  folderSortList.push(fileItem);
                  // if (maxDate.isBefore(fdate)) {
                  //   maxDate = fdate;
                  // }
                }
              }
            }
          }
        }
        if (fileSortList.length > 5) {
          fileSortList.sort((a, b) => {
            if (a.sortDate.isBefore(b.sortDate)) {
              return 1;
            } else if (a.sortDate.isSame(b.sortDate)) {
              return 0;
            } else {
              return -1;
            }
          });

          for (let f = 5; f < fileSortList.length; f++) {
            fileSortList[f].doNotSend = true;
          }
        }

        if (folderSortList.length > 5) {
          folderSortList.sort((a, b) => {
            if (a.sortDate.isBefore(b.sortDate)) {
              return 1;
            } else if (a.sortDate.isSame(b.sortDate)) {
              return 0;
            } else {
              return -1;
            }
          });

          for (let f = 5; f < folderSortList.length; f++) {
            folderSortList[f].doNotSend = true;
          }
        }

        console.log('FILESORT', fileSortList);


        const dataBackupItem = this.folders[response.folderIndex];
        if (foundDataBackup === true && this.folderIndex < 2) {
          minDiff = moment().diff(maxDate, 'days') + 1;
          this.logger.debug('STARTCHECK', minDiff);
          // 에러 저장 : 폴더1, 폴더2에 대해서만 체크
          if (dataBackupItem != null) {
            let message = '';
            if (minDiff >= 10) {
              dataBackupItem.error = '10days';
              message = '[폴더' + (this.folderIndex + 1) + '] 10일간 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
              // this.electronService.ipcRenderer.send('ALERT', {message: message});
            } else if (minDiff >= 5) {
              dataBackupItem.error = '5days';
              message = '[폴더' + (this.folderIndex + 1) + '] 5일간 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
              // this.electronService.ipcRenderer.send('ALERT', {message: message});
            }
            if (zipFound === false) {
              dataBackupItem.error = 'nozip';
              message = '[폴더' + (this.folderIndex + 1) + '] 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
              // this.electronService.ipcRenderer.send('ALERT', {message: message});
            }
          }
        }
        /*----------------------------------------------------
         *  이상유무를 서버에 저장
         *---------------------------------------------------*/
        dataBackupItem.lastUploaded = moment().unix() * 1000;
        dataBackupItem.lastZip = maxDate.unix() * 1000;
        dataBackupItem.count = folderSize;
        dataBackupItem.deviceResource = this.deviceResource;

        this.member = this.memberAPI.isLoggedin();
        this.memberAPI.detail(this.member).subscribe(res => {
          this.logger.debug('##MEMBER', res.member);
          this.member = res.member;
          this.memberAPI.updateFolderData(dataBackupItem, this.member).subscribe(updateRes => {
              {
                this.logger.debug(updateRes);
              }
            },
            error => {
              this.logger.debug(error);
            }
          );
        });


        if (this.deviceResource == null) {
          this.deviceResource = {
            macaddress: 'MAC'
          };
        }

        dataBackupItem.version = environment.VERSION;
        const post = {
          type: 'folderData',
          title: dataBackupItem.path,
          categories: [this.deviceResource.macaddress],
          code: this.member.id + '##' + this.deviceResource.macaddress + '##' + dataBackupItem.path,
          userData: JSON.stringify(dataBackupItem),
          checkCode: 'true',
          checkCodeAction: 'update',
        };

        this.logger.debug('###################', post);
        this.postAPI.save(this.board.id, post,
          null
        ).subscribe(saveResponse => {
            {
              this.logger.debug(saveResponse);
            }
          },
          error => {
            this.logger.debug(error);
          }
        );
        this.subject.next(this.filesToSend[0]);
      }
    );


    /*----------------------------------------------------
     *  IPC Response : Send File Response
     *  다음 파일을 보내도록 next에 밀어넣기
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('SENDFILE', (event: Electron.IpcMessageEvent, response: any) => {
      this.logger.debug('FILE', response, this.filesToSend);
      let message = '';
      console.log(response);
      if(response.error === null ){
        message = ' : 파일 업로드 완료 (' + (response.index + 1) + '/' + this.filesToSend.length + ')';
        console.log(message);
        //메세지를 뿌릴려고..
        this.notification.next({
           cmd: 'LOG',
          message: '[' + (this.folderIndex + 1) + '] ' + message
        });
      }else{
        message = ' : 파일 업로드 실패 ';
        console.log(message);
        this.notification.next({
             cmd: 'LOG',
             message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
          });
      }
      // if (response.body != null && response.body.header != null && response.body.header.code === 200) {
      //   message = ' : 파일 업로드 완료 (' + (response.index + 1) + '/' + this.filesToSend.length + ')';
      //   this.notification.next({
      //     cmd: 'LOG',
      //     message: '[' + (this.folderIndex + 1) + '] ' + path.basename(response.body.post.code) + message
      //   });
      // } else {
      //   if (response.body !== undefined && response.body.header != null) {
      //     message = ' : 파일 업로드 실패 (' + response.body.header.message + ')';
      //     this.notification.next({
      //       cmd: 'LOG',
      //       message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
      //     });
      //   } else if (response.body.error !== undefined) {
      //     message = ' : 파일 업로드 실패 (' + response.body.error + ')';
      //     this.notification.next({
      //       cmd: 'LOG',
      //       message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
      //     });
      //   } else {
      //     message = ' : 파일 업로드 실패 (' + response.body + ')';
      //     this.notification.next({
      //       cmd: 'LOG',
      //       message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
      //     });
      //   }
      // }
      this.gotoNextFile(response.index);
    });
  }


  private getFolderKey(folderIndex) {
    if (this.member == null) {
      this.member = this.memberAPI.isLoggedin();
    }
    return 'folder:' + this.member.id + ':' + folderIndex;
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Process Tree to File list to send
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private processTreeElement(folderIndex, fileItem) {
    console.log('folderIndex :',folderIndex);
    console.log('fileItem :',fileItem);
    let size = 0;
    if (this.filesToSend == null) {
      this.filesToSend = [];
    }

    if (fileItem.type === 'folder') {
      console.log('folder');
      /*---------------------------------------------------------------
       * 폴더
       *---------------------------------------------------------------*/
      for (const c in fileItem.children) {
        if (fileItem.children.hasOwnProperty(c)) {
          size += this.processTreeElement(folderIndex, fileItem.children[c]);
        }
      }

      this.filesToSend.push({
        folderIndex: folderIndex,
        index: this.filesToSend.length,
        file: fileItem,
        size: size
      });
      return size;

    } else if (fileItem.type === 'file') {
      /*---------------------------------------------------------------
       * 파일
       *---------------------------------------------------------------*/
      console.log('file');
      this.filesToSend.push({
        folderIndex: folderIndex,
        index: this.filesToSend.length,
        folder: path.basename(fileItem.fullpath),
        file: fileItem
      });
      size += fileItem.size;
    }
    return size;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  다음 파일 보내기
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private gotoNextFile(index) {
    console.log('gotoNextFile send = ',this.filesToSend.length,'index= ',index);
    if (this.filesToSend.length - 1 > index) {
      this.subject.next(this.filesToSend[index + 1]);
    } else {
      this.notification.next({
        cmd: 'LOG',
        message: '"폴더' + (this.folderIndex + 1) + '" : ' + this.folders[this.folderIndex].path + ' 업로드 종료'
      });
      this.notification.next({
        cmd: 'FOLDER.SENT',
        folderIndex: this.folderIndex
      });
      this.uploading = false;
    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  *  send a file
  -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private processFile(item) {
    console.log('업로드처리 시작 processFile');
    if (item == null || this.folders[item.folderIndex].path === undefined) {
      return;
    }
    this.logger.debug('===', item);
    const file = item.file;
    let post;
    this.member = this.memberAPI.isLoggedin();

    /*---------------------------------------------------------------
        폴더도 Post를 하나 추가해놓아야함
     ----------------------------------------------------------------*/

    const paths = path.dirname(file.fullpath).split(path.sep);
    const parentPath = (paths.slice(0, paths.length).join(path.sep)).replace(/\\/g, '/');
    const folderName = this.folders[item.folderIndex].path.replace(/\\/g, '/');
    const code = file.fullpath.replace(/\\/g, '/');
    let username = localStorage.getItem('username');
    username = username = username.replace(/"/g, '').replace(/"/g, '');
   // let username = member.id; //JSON.stringify(member);
    let password = localStorage.getItem('password');
    //password = password = password.replace(/"/g, '').replace(/"/g, '');

    console.log('사용자이름: ',username);
    console.log('패스워드: ',password);

    if (item.file.type === 'folder') {
      post = {
        index: item.index,
        file: file,
        url: M5Service.server + '/v1/boards/' + this.board.id + '/posts?accessToken=' + encodeURI(this.accessToken),
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.member.id + '##' + this.deviceResource.macaddress + '##' + code,                                   // 파일의 fullpath
          subtitle: code,
          checkCode: 'true',
          checkCodeAction: 'update',
          userData: {
            parentPath: parentPath,
            totalSize: item.size,
            created: file.created,
            updated: file.updated,
            accessed: file.accessed,
          }
        },
       // accessToken: this.storageService.get('accessToken'),
        accessToken: this.storageService.get('userToken'),
        apiKey: M5Service.apiKey,
        username:username,
        pwd:password
      };
    } else {

      post = {
        index: item.index,
        file: file,
        url: M5Service.server + '/v1/boards/' + this.board.id + '/posts?accessToken=' + encodeURI(this.accessToken),
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.member.id + '##' + this.deviceResource.macaddress + '##' + code,                                   // 파일의 fullpath
          subtitle: code,
          checkCode: 'true',
          checkCodeAction: 'update',
          userData: {
            parentPath: parentPath,
            totalSize: file.size,
            created: file.created,
            updated: file.updated,
            accessed: file.accessed,
          }
        },
       // accessToken: this.storageService.get('accessToken'),
       accessToken: this.storageService.get('userToken'),
        apiKey: M5Service.apiKey,
        username:username,
        pwd:password
      };
    }

    /*---------------------------------------------------------------
          이미 존재하는지 체크
        ----------------------------------------------------------------*/
    let existPost = null;
    this.postAPI.list(this.board.id, {
      type: 'item',
      andFields: JSON.stringify({code: this.member.id + '##' + this.deviceResource.macaddress + '##' + code}),
      fetchMode: 'admin'
    }).subscribe(
      response => {

        if (ObjectUtils.isNotEmpty(response.posts)) {
          existPost = response.posts[0];
        }

      },
      error => {
        console.log('CHECK EXITS ERROR', error);
      });

    /*---------------------------------------------------------------
        업로드 제외 파일
      ----------------------------------------------------------------*/
    if (this.filesToSend[item.index].doNotSend === true) {
      const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename;
      this.notification.next({
        cmd: 'LOG',
        message: message + ' : 업로드 제외 파일입니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
      });
      if (existPost != null) {
        this.notification.next({
          cmd: 'LOG',
          message: message + ' : 클라우드에서 삭제됩니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
        });
        this.postAPI.delete(existPost.id, {}).subscribe(
          response => {
            this.gotoNextFile(item.index);
          },
          error => {
            this.gotoNextFile(item.index);
          }
        );
      }
      else {
        this.gotoNextFile(item.index);
      }

    }
    /*---------------------------------------------------------------
        업로드해야할 파일
      ----------------------------------------------------------------*/
    else {

      console.log('-=-=-=', this.deviceResource.macaddress + '##' + code);

      if (existPost == null) {
        const pipe = new BytesPipe();
        const size = pipe.transform(this.filesToSend[item.index].file.size);
        this.notification.next({
          cmd: 'SENDING.STARTED',
          message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size + '토큰..'+post.accessToken
        });

        this.electronService.ipcRenderer.send('SENDFILE', post);
      } else {
        this.logger.debug('이미 업로드된 파일', code);
        const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' (' + (item.index + 1) + '/' + this.filesToSend.length + ')';
        this.notification.next({
          cmd: 'LOG',
          message: message + ' : 이미 업로드된 파일입니다. ' // + response.posts[0].id
        });
        this.gotoNextFile(item.index);
      }


      if (this.filesToSend.length - 1 > item.index) {
        this.subject.next(this.filesToSend[item.index + 1]);
      } else {
        this.gotoNextFile(item.index);
      }

    }

  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  main entry
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  upload(folderIndex, fullpath) {
    if (this.uploading === true) {
      return;
    }

    this.uploading = true;
    this.folderIndex = folderIndex;

    if (this.folders[folderIndex] == null) {
      console.log('폴더가 mull');
      this.folders[folderIndex] = [];
      console.log('폴더가 ', this.folders[folderIndex]);
    }

    if (this.folders[folderIndex].path === undefined) {
      this.uploading = false;
      if (this.electronService.isElectronApp) {
        this.notification.next({cmd: 'LOG', message: '폴더' + (folderIndex + 1) + '는 지정 되지 않았습니다.'});
        this.notification.next({
          cmd: 'FOLDER.SENT',
          folderIndex: this.folderIndex
        });

      }
    } else {
      this.folders[folderIndex].path = fullpath;
      if (this.electronService.isElectronApp) { //앱이 실행중이라면..
        console.log('11..앱이실행중이라 업로드');
        this.notification.next({cmd: 'LOG', message: this.folders[folderIndex].path + ' 업로드를 시작합니다.'});
        this.electronService.ipcRenderer.send('GETFOLDERTREE', {
          folderIndex: folderIndex,
          path: this.folders[folderIndex].path
        });
      }
    }
  }

  getFolderPath(folderIndex) {
    return this.folders[folderIndex].path;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Process a file
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  notified(): Observable<any> {
    return this.notification.asObservable();
  }

}
