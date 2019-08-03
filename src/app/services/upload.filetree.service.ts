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
const request = require('request');


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
      //console.log('PCRESOURCE deviceResource : ', this.deviceResource);
      console.log('받음 upload.filetree, PCRESOURCE');
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
        //console.log('44..앱이실행중이라 업로드 fileTree : ',fileTree);
        console.log(this.folderIndex);
        console.log(fileTree.length);
        console.log('받음, GETFOLDERTREE, upload-filetree');
        //파일이 없으면?
        //if(typeof fileTree.length == 'undefined')
        if(fileTree.length == undefined){
          console.log('백업할 파일이 없음');
          this.notification.next({cmd: 'LOG', message: '백업할 파일이 없습니다.'});
          this.gotoNextFile(this.folderIndex);
          return; 
        }
        //this.folders[folderIndex].path
        
        fileTree.forEach(element => {
          folderSize += this.processTreeElement(this.folderIndex, element);

        });
        //kimcy
        // var getSize = require('get-folder-size');

        // getSize(this.getFolderPath(this.folderIndex), function(err, folderSize) {
        //   if (err) { throw err; }

        //   //console.log(size + ' bytes');
        //   console.log((folderSize / 1024 / 1024).toFixed(2) + ' Mb');
        // });


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
        console.log('upload.filetree, 기준시간?? ', maxDate);
        const fileSortList = [];
        const folderSortList = [];

        // 최근 5개 계산을 위한 정렬용 배열에 채워넣는다.
        console.log('upload.filetree, filesToSend?? ', this.filesToSend);
        for (const f in this.filesToSend) {
          if (this.filesToSend.hasOwnProperty(f)) {
            const fileItem = this.filesToSend[f];

            const folderName = path.dirname(fileItem.file.fullpath);
            const paths = folderName.split(path.sep);
            console.log('folderName = ',folderName,'paths = ',paths);
            if (paths[paths.length - 1].toLowerCase().indexOf('data_backup') >= 0) { //데이터백업폴더명(대소문자는조금씩다름): DATA_BACKUP
              console.log('백업폴더가 있다');
              foundDataBackup = true;
              const filename = fileItem.file.filename;
              const fyyyy = Number(filename.substr(0, 4));
              const fmm = Number(filename.substr(4, 2));
              const fdd = Number(filename.substr(6, 2));
              const fdate = moment([fyyyy, fmm - 1, fdd]);
              console.log('fileItem = ',fileItem);
              console.log('fdate = ',fdate);
              if (fdate.isValid()) {  //fdate가 시간문자열형태라면 참

                console.log('fileItem.file.type = ',fileItem.file.type);
                console.log('filename = ',filename);
                if (fileItem.file.type === 'file') {
                  console.log('data_backup/파일');
                  if (filename.toLowerCase().indexOf('.zip') > 0) {
                    console.log('data_backup/zip파일');
                    zipFound = true;
                    fileItem.sortDate = fdate;
                    fileSortList.push(fileItem);  //zip파일이 발견되면 증가함
                    if (maxDate.isBefore(fdate)) {
                      console.log('maxDate 변경');
                      maxDate = fdate;
                    }else{
                      console.log('maxDate 변경안함');
                    }
                  }
                  // else{
                  //   console.log('data_backup/zip파일이 아님');
                  // }
                } else if (fileItem.file.type === 'folder') {
                  console.log('data_backup/서브폴더');
                  fileItem.sortDate = fdate;
                  folderSortList.push(fileItem);
                  // if (maxDate.isBefore(fdate)) {
                  //   maxDate = fdate;
                  // }
                }
              }else{
                console.log('fdate false  ');
              }
            }
          }
        }
        console.log('upload.filetree 길이 = ',fileSortList.length);
        if (fileSortList.length > 5) {
          console.log('5개이상  ');
          fileSortList.sort((a, b) => {  //소팅을 해서 가장 최근것만 올리게 ..
            if (a.sortDate.isBefore(b.sortDate)) {
              console.log('시간이 이전');
              return 1;
            } else if (a.sortDate.isSame(b.sortDate)) {
              console.log('시간이 동일');
              return 0;
            } else {
              return -1;
            }
          });

          for (let f = 5; f < fileSortList.length; f++) {
            console.log('upload.filetree , 11..파일업로드 안함, fileSortList[f] = ',f, fileSortList[f])
            fileSortList[f].doNotSend = true;  //파일업로드 안함, 업로드 안할놈은 배열의 5번째 이후임
          }
        }
        console.log('upload.filetree , 정렬된 값, fileSortList = ',fileSortList);
        //kimcy 동일한 루틴이라 삭제
        // if (folderSortList.length > 5) {
        //   folderSortList.sort((a, b) => {
        //     if (a.sortDate.isBefore(b.sortDate)) {
        //       return 1;
        //     } else if (a.sortDate.isSame(b.sortDate)) {
        //       return 0;
        //     } else {
        //       return -1;
        //     }
        //   });

        //   for (let f = 5; f < folderSortList.length; f++) {
        //     console.log('upload.filetree , 22..파일업로드 안함, fileSortList[f] = ',f, fileSortList[f])
        //     folderSortList[f].doNotSend = true;  //폴더업로드 안함
        //   }
        // }

        console.log('uplaod.filetree, FILESORT', fileSortList);


        const dataBackupItem = this.folders[response.folderIndex];
        console.log('upload.filetree foundDataBackup = ', foundDataBackup, 'folderIndex = ',this.folderIndex);
        console.log('dataBackupItem = ',dataBackupItem, 'response.folderIndex = ',response.folderIndex);
        if (foundDataBackup === true && this.folderIndex < 2) {
          minDiff = moment().diff(maxDate, 'days') + 1;
          this.logger.debug('STARTCHECK', minDiff);
          //에러 저장 : 폴더1, 폴더2에 대해서만 체크
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
        //kimcy 추후.
        // this.memberAPI.detail(this.member).subscribe(res => {
        //   this.logger.debug('##MEMBER', res.member);
        //   this.member = res.member;
        //   this.memberAPI.updateFolderData(dataBackupItem, this.member).subscribe(updateRes => {
        //       {
        //         console.log('upload.filetree updateFolderData 성공');
        //         this.logger.debug(updateRes);
        //       }
        //     },
        //     error => {
        //       console.log('upload.filetree updateFolderData 실패');
        //       this.logger.debug(error);
        //     }
        //   );
        // });


        if (this.deviceResource == null) {
          this.deviceResource = {
            macaddress: 'MAC'
          };
        }

        //kimcy: dataBackupItem 이란? 마지막 업로드. 에러(10일, 5일, nozip), 마지막zip, count, 디바이스리소스
        dataBackupItem.version = environment.VERSION;
        //kimcy
        const post = {
          type: 'folderData',
          title: dataBackupItem.path,
          categories: [this.deviceResource.macaddress],
          code: this.member.username + '##' + this.deviceResource.macaddress + '##' + dataBackupItem.path,
          userData: JSON.stringify(dataBackupItem),
          checkCode: 'true',
          checkCodeAction: 'update',
        };

        this.logger.debug('###################', post);
        //kimcy 일단 추후 구현
        // this.postAPI.save(this.board.id, post,
        //   null
        // ).subscribe(saveResponse => {
        //     {
        //       console.log('upload.filetree postAPI.save 성공');
        //       this.logger.debug(saveResponse);
        //     }
        //   },
        //   error => {
        //     console.log('upload.filetree postAPI.save 실패');
        //     this.logger.debug(error);
        //   }
        // );
        this.subject.next(this.filesToSend[0]); //processFile 호출??
      }
    );


    /*----------------------------------------------------
     *  IPC Response : Send File Response
     *  다음 파일을 보내도록 next에 밀어넣기
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('SENDFILE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음, upload.filetree, SENDFILE ');
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
        console.log(message, this.filesToSend[response.index]);
        this.notification.next({
             cmd: 'LOG',
             //message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
             message: '[' + (this.folderIndex + 1) + '] ' +  message
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
    //kimcy
    //return 'folder:' + this.member.id + ':' + folderIndex;
    return 'folder:' + this.member.username + ':' + folderIndex;
  }
  
  private initialize(containername, token) {
    // Setting URL and headers for request
    console.log('initialize => containername = ',containername);
    console.log('initialize => token = ',token);
    var options = {
        uri: M5MemberService.s3Storage+'/'+containername+'?format=json',
        headers: {
          'X-Auth-Token': token
        }
    };
    // Return new promise 
    return new Promise(function(resolve, reject) {
      // Do async job
        request.get(options, function(err, resp, body) {
            if (err) {
              console.log('목록얻어오기 실패 = ',err);
                reject(err);
            } else {
                if(resp.statusCode == 200){
                   console.log('목록얻어오기 성공');
                  // console.log(resp.statusCode);
                   console.log(body);
                  //resolve([resp.headers,body]);  //배열로 멀티값전달
                  resolve(body);
                }else if(resp.statusCode == 204){
                  console.log('처음 목록얻어오기 성공');
                  resolve("No Content");
                }
                else{
                  console.log('목록얻어오기 실패');
                  reject(resp);
                }
            }
        });
    });
  }
  
  //kimcy
  getContainerList(storage){
    const STORAGE_URL = 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3';
    this.member = this.storageService.get('member');
    var contaniername = this.member.username.replace(/"/g, '').replace(/"/g, '');
    var initializePromise = this.initialize(contaniername, this.member.token);

    console.log('getContainerList');
    initializePromise.then(function(result) {
        storage.set('list',result);
       //console.log("11..결과 body :",storage.get('list'));

    }, function(err) {
        console.log(err);
    })

  }

  //kimcy: 추후 목록조회 실패시 서버에게 토큰 요청하는 루틴을 만들어 놓아야 하는 자리임
  //console.log("결과 body :",existPost[1]);


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Process Tree to File list to send
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private processTreeElement(folderIndex, fileItem) {
    console.log('uppload.filetree, processTreeElement => folderIndex :',folderIndex);
    console.log('fileItem :',fileItem); //하나의 파일
    console.log('fileItem 타입 :',fileItem.type); //하나의 파일
    console.log('filesToSend :',this.filesToSend);  //어디서 값을 넣어줬을끼?, 현재는 배열로 폴더에 있는 파일들을 가르킨다.
    let size = 0;
    if (this.filesToSend == null) {
      this.filesToSend = [];
    }

    if (fileItem.type === 'folder') {
      console.log('folder');
      //const getSize = require('get-folder-size');
      /*---------------------------------------------------------------
       * 폴더
       *---------------------------------------------------------------*/
      for (const c in fileItem.children) {
        if (fileItem.children.hasOwnProperty(c)) {
          size += this.processTreeElement(folderIndex, fileItem.children[c]);
        }
      }
      //kimcy
      // getSize(this.getFolderPath(this.folderIndex), function(err, size) {
      //   if (err) { throw err; }
      
      //   //console.log(size + ' bytes');
      //   console.log((size / 1024 / 1024).toFixed(2) + ' Mb');
      // });

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
      console.log('upload.filetree  filesToSend 에 넣기 ',fileItem);
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
      console.log('업로드 종료');
      // this.notification.next({
      //   cmd: 'LOG',
      //   message: '"폴더' + (this.folderIndex + 1) + '" : ' + this.folders[this.folderIndex].path + ' 업로드 종료'
      // });
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

    console.log('업로드 file: ',file);
    /*---------------------------------------------------------------
        폴더도 Post를 하나 추가해놓아야함
     ----------------------------------------------------------------*/

    const paths = path.dirname(file.fullpath).split(path.sep);  //fullpath를 /로 분리하여 저장
    console.log('업로드 paths: ',paths);  
    const parentPath = (paths.slice(0, paths.length).join(path.sep)).replace(/\\/g, '/');
    console.log('업로드 parentPath: ',parentPath);
    const folderName = this.folders[item.folderIndex].path.replace(/\\/g, '/');
    console.log('업로드 folderName: ',folderName);
    const code = file.fullpath.replace(/\\/g, '/');  //비교대상
    console.log('업로드 code: ',code);
 
    //let username = this.member.username.replace(/"/g, '').replace(/"/g, '');
   // let password = this.member.password.replace(/"/g, '').replace(/"/g, '');
   // let userToken = this.member.token.replace(/"/g, '').replace(/"/g, '');
   let userToken = this.member.token;
   let username = this.member.username;

  //  console.log('userToken = ',userToken);
  //  console.log('username = ',username);



    if (item.file.type === 'folder') {
      let uertoken = 
      post = {
        index: item.index,
        file: file,
        //url: M5Service.server + '/v1/boards/' + this.board.id + '/posts?accessToken=' + encodeURI(this.accessToken),
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.member.username + '##' + this.deviceResource.macaddress + '##' + code,                                   // 파일의 fullpath
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
        accessToken: userToken,
       // apiKey: M5Service.apiKey,
        username:username,
       // pwd:password
      };
    } else {
     // console.log('file  타입: ',this.storageService.get('userToken'));
      post = {
        index: item.index,
        file: file,
      //  url: M5Service.server + '/v1/boards/' + this.board.id + '/posts?accessToken=' + encodeURI(this.accessToken),
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.member.username + '##' + this.deviceResource.macaddress + '##' + code,                                   // 파일의 fullpath
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
        accessToken: userToken,
        //apiKey: M5Service.apiKey,
        username:username,
      //  pwd:password
      };
    }

    /*---------------------------------------------------------------
          이미 존재하는지 체크
        ----------------------------------------------------------------*/
    let existPost = null;
    var listObj = this.storageService.get('list');
    //console.log('upload.filetree, 리스트목록 = ',listObj);
    if(listObj != '[]' && listObj != 'No Content' && file.type != 'folder'){
      let jsonExitPost = JSON.parse(listObj);

      for(var ele in jsonExitPost){
        //동일한 이름값이면 filesize체크해서 변경유무 파악
        // console.log('목록있음,,,jsonExitPost[ele].name = ',ele, jsonExitPost[ele].name);
         console.log('한글 = ', code);
        if(jsonExitPost[ele].name === code){
          if(jsonExitPost[ele].bytes === file.size){
            existPost = 'update-already';
            console.log('업데이트된 파일');
            jsonExitPost.splice(ele,1);
            var list = JSON.stringify(jsonExitPost);
            console.log('list = ', list);
            this.storageService.set('list',list);
            break;
          }
        }
      }
    }else if(listObj === '[]' || listObj === 'No Content'){
      console.log('맨 처음 올리는것임');
    }else{
      console.log('에러');
     // this.gotoNextFile(this.filesToSend.length);
    }

    


    /*---------------------------------------------------------------
        업로드 제외 파일
      ----------------------------------------------------------------*/
    //data_backup/zip파일을 날짜별로 소팅해서 오래된것에는 doNotSend flag를 셋팅했음
    if (this.filesToSend[item.index].doNotSend === true) {
      console.log('업로드제외파일');
      const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename;
      this.notification.next({
        cmd: 'LOG',
        message: message + ' : 업로드 제외 파일입니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
      });
      

      //kimcy: 서버에 data_backup/zip파일(이전) 삭제에 관한 것 더 논의하여 작업
      // if (existPost != null) {
      //   this.notification.next({
      //     cmd: 'LOG',
      //     message: message + ' : 클라우드에서 삭제됩니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
      //   });
      //   this.postAPI.delete(existPost.id, {}).subscribe(
      //     response => {
      //       this.gotoNextFile(item.index);
      //     },
      //     error => {
      //       this.gotoNextFile(item.index);
      //     }
      //   );
      // }
      //else 
      {
        console.log('upload.filetree, item.index = ',item.index);
        this.gotoNextFile(item.index);
      }

    }
    /*---------------------------------------------------------------
        업로드해야할 파일
      ----------------------------------------------------------------*/
    else {

      console.log('업로드해야할 파일', this.deviceResource.macaddress + '##' + code);

      if (existPost == null && file.type != 'folder') {
        const pipe = new BytesPipe();
        const size = pipe.transform(this.filesToSend[item.index].file.size);
        this.notification.next({
          cmd: 'SENDING.STARTED',
          message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
        });
        console.log('보냄, upload.filetree, SENDFILE ');
        this.electronService.ipcRenderer.send('SENDFILE', post);
      } else if(existPost == null && file.type === 'folder'){
        console.log('폴더는 업로드 하지 않음');
        this.gotoNextFile(item.index);
      } else {
        this.logger.debug('이미 업로드된 파일', code);
        const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' (' + (item.index + 1) + '/' + this.filesToSend.length + ')';
        this.notification.next({
          cmd: 'LOG',
          message: message + ' : 이미 업로드된 파일입니다. ' // + response.posts[0].id
        });
        this.gotoNextFile(item.index);
      }


      console.log('11..filesToSend.length = ',this.filesToSend.length,'item.index = ',item.index);
      //kimcy: 왜 다음파일을 보낼려고 하지?
      // if (this.filesToSend.length - 1 > item.index) {
      //   console.log('this.subject.next');
      //   this.subject.next(this.filesToSend[item.index + 1]);
      // } else {
      //   this.gotoNextFile(item.index);
      // }

    }

  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  main entry
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  upload(folderIndex, fullpath) {

    console.log('upload.filetree folderIndex =  ',folderIndex, 'fullpath = ',fullpath);
    if (this.uploading === true) {
      console.log('업로딩중이라 리턴');
      return;
    }

    this.uploading = true;
    this.folderIndex = folderIndex;

    console.log('this.folders[folderIndex]',folderIndex, this.folders[folderIndex]);
    //kimcy
    if (this.folders[folderIndex] == null) {
      console.log('폴더가 mull');
      this.folders[folderIndex] = [];
      console.log('폴더가 ', this.folders[folderIndex]);
    }

    console.log('this.folders[folderIndex].path = ',this.folders[folderIndex].path);
    if (this.folders[folderIndex].path === undefined) {
      this.uploading = false;
      if (this.electronService.isElectronApp) {
        //kimcy: 지정되지 않음이 계속나와 this.folderIndex를 +1시킴 -> 다음폴더이동, 했더니 문제가 있어서 원복
        this.notification.next({cmd: 'LOG', message: '폴더' + (folderIndex + 1) + '는 지정 되지 않았습니다.'});
        this.notification.next({
          cmd: 'FOLDER.SENT',
          folderIndex: this.folderIndex
        });

      }
    } else {
      this.folders[folderIndex].path = fullpath;
      if (this.electronService.isElectronApp) { //앱이 실행중이라면..
        console.log('11..upload ->앱이실행중이라 업로드');
        this.notification.next({cmd: 'LOG', message: this.folders[folderIndex].path + ' 업로드를 시작합니다.'});
        console.log('보냄, GETFOLDERTREE, upload-filetree');
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
