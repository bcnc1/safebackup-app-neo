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
import { stat } from 'fs';
const request = require('request');
const fs = require('fs');
const log = require('electron-log');
const PAGE_COUNT = 1000;
const {app} = require("electron");

// var knex = require('knex')({
//   client: 'sqlite3',
//   connection: {
//     filename: app.getPath('userData')+'/'+ 'sb.db'
//   }
// });

 function getObjList(containername, token,  marker, list) {
    
    
  // console.log('lnitObjList = ',containername, 'token = ',token,
  //             'marker = ',marker,'list = ',list);
              
  var options = {
      uri: M5MemberService.s3Storage+'/'+containername+'?format=json'
           +'&limit='+1000+'&marker='+marker,
      headers: {
        'X-Auth-Token': token
      }
  };
  // Return new promise 
  return new Promise(function(resolve, reject) {
    // Do async job
      request.get(options, function(error, response, body) {
        if (!error && (response.statusCode == 200)){
          var objCountInContainer = parseInt(response.headers['x-container-object-count']);
          console.log("목록 : count : " + objCountInContainer);

          if(objCountInContainer <= 1000) {
            // one time
            resolve(body);
          }else {
            var partiallist;
            
            list += body;
            list = list.replace("][", ",").replace(",]", "]");
            console.log('1000개 이상 = ',list);
            partiallist = JSON.parse(body);

            if(partiallist.length == 0) {
              // console.log("file list : " + list);
              partiallist = JSON.parse(list);
              console.log("my file list count : " + partiallist.length);
              resolve(list);
            }
            else {
              marker = partiallist[partiallist.length-1].name; // the last
              console.log('재귀함수 호출');
              resolve(getObjList(containername, token, marker, list));
              //console.log('this = ', typeof this);
              //resolve(['recursive', marker, list, this]);
            }
          }
        }else if (!error && (response.statusCode == 404 || response.statusCode == 204)) {
            resolve(list);
        }else{
          reject(error);
        } 
      });
  });
}


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
  private test; //kimcy

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Constructor
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  fillFollders() {
    //console.log('fillFollders ');
    this.folders = new Array(4);


    for (let i = 0; i < 4; i++) {
      this.folders[i] = {
        path: this.storageService.get(this.getFolderKey(i))
      };
    }

    //console.log('this.folders = ',this.folders);
  }


  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private electronService: ElectronService,
    private konsoleService: KonsoleService,
    private logger: NGXLogger,
    @Inject(LOCAL_STORAGE) private storageService: StorageService) {
    //this.member = this.memberAPI.isLoggedin();
    this.member;
    console.log('dd..맴버 = ',this.member);

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
      console.log('받음 upload.filetree, PCRESOURCE 디바이스 = ',this.deviceResource);
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
     *  IPC Response : Get FileTree 예는 아래와 같다.
     * (3) [{…}, {…}, {…}]
          0:
          filename: ".DS_Store"
          fullpath: "/Users/kimcy/Downloads/bk2/.DS_Store"
          size: 6148
          type: "file"
          __proto__: Object
          1:
          filename: "main.js"
          fullpath: "/Users/kimcy/Downloads/bk2/main.js"
          size: 11685
          type: "file"
          __proto__: Object
          2:
          filename: "손예진!.jpg"
          fullpath: "/Users/kimcy/Downloads/bk2/손예진!.jpg"
          size: 5023
          type: "file"
          __proto__: Object
          length: 3
          __proto__: Array(0)
          folderIndex: 0,
          index: 3,
          children: {children: Array(0), name: "kim", type: "folder"}
          filename: "kim"
          fullpath: "/Users/kimcy/Downloads/bk2/kim"
          size: 64
          type: "folder"
          //하는일:
          1. npk폴더이면 압축
          2. 한폴더가 다 끝났으면 다음폴더
          3. 전달 받은 파일트리로 부터 목록구성
          4. 업로드 목록구성하고 해당폴더의 전체 사이즈 계산하야여 전달
     ----------------------------------------------------*/
     this.electronService.ipcRenderer.on('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('업로드, response = ',response);

      //fullpath 변수 사용? 안하게?
      //목록 구성이 끝난 폴더의 사이즈 요청
      //1. 블록체인 에러 목록 요청 하고 업로드
      this.requestChainErrorList();

      //2. 업로드 목록 요청 하고 업로드
      this.requestUploadList();

      //3. 업데이트 목록 요청()하고 업로드;
      this.requestUpdateList();

      //4.npki폴더 압축하고 db에 저장하라고? / npki폴더 압축하고 바로 업로드

      //5.선택된 폴더 완료 되면 다음 폴더가 있으면 다음폴더 진행

     });


    // this.electronService.ipcRenderer.on('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any) => {
    //     const fileTree = response.tree;   //파일의 tree구성
    //     console.log('fileTree = ',fileTree);
    //     let folderSize = 0;
    //     this.folderIndex = response.folderIndex;
    //     this.filesToSend = [];
    //     //console.log('44..앱이실행중이라 업로드 fileTree : ',fileTree);
    //     console.log(this.folderIndex);
    //     console.log(fileTree.length);
    //     console.log('받음, GETFOLDERTREE, upload-filetree');

    //     if(fileTree.length === undefined && fileTree.name.lastIndexOf('NPKI') != -1){
    //         console.log('NPKI폴더');
    //         const child_process = require("child_process");
    //         let filename;
    //         var date = new Date(); 
    //         var year = date.getFullYear(); 
    //         var month = new String(date.getMonth()+1); 
    //         var day = new String(date.getDate()); 
            
    //         // 한자리수일 경우 0을 채워준다. 
    //         if(month.length == 1){ 
    //           month = "0" + month; 
    //         } 
    //         if(day.length == 1){ 
    //           day = "0" + day; 
    //         } 
            
    //         var toDay = year.toString() + month + day;
    //         this.member = this.memberAPI.isLoggedin();
    //         console.log('22..맴버 = ',this.member);
    //         if(this.member != undefined){
    //           filename = toDay+'-'+this.member.username+'-'+'NPKI';
    //         }
    //         console.log('filename = ',filename);

    //         var filepath = fileTree.name + '/' + filename + '.zip';

    //         //먼저 해당 파일이 있는지 확인하고 있다면 지우고 시작해야 중복되지 않는다.
    //         // 한파일만 지울때 
    //         // if (fs.existsSync(filepath)) {
    //         //   console.log('The file exists.');
    //         //   try {
    //         //     fs.unlinkSync(filepath);
    //         //     console.log('successfully deleted ',filepath);
    //         //   } catch (err) {
    //         //     // handle the error
    //         //     console.log('fail deleted ',filepath);
    //         //   }
    //         // }
            
    //         //zip파일 모두 지우게...
    //         console.log('fileTree.name = ',fileTree.name);
    //         try{
    //           var files = fs.readdirSync(fileTree.name);
    //           for(var i in files) {
    //             // console.log('files[i] = ',files[i]);
    //             // console.log('zip[i] = ',files[i].toLowerCase().lastIndexOf('.zip'));
    //             if(files[i].toLowerCase().lastIndexOf('.zip') > 0){
    //               fs.unlinkSync(fileTree.name+'/'+files[i]);
    //               //console.log('zip파일 삭제');
    //             }else{
    //               //console.log('zip파일 아님');
    //             }
                
    //           }
    //         }catch(err){
    //           //console.log('zip파일 실패');
    //         }
            

    //         var zipper = require('zip-local');
    //         try{
    //           zipper.sync.zip(fileTree.name).compress().save(filepath);
    //           console.log('zip파일 성공');
    //         } catch(err){
    //           console.log('zip파일 삭제');
    //         }
           
            
    //         var stats = fs.statSync(filepath);
    //         folderSize = stats.size;

    //         var fileitem ={type:'file', filename: path.basename(filepath), fullpath : filepath, 
    //                        size: stats.size /*, accessed:stats.atime, updated:stats.mtime, created:stats.ctime*/};
            

    //         this.filesToSend.push({
    //           folderIndex: this.folderIndex,
    //           index: 0,                         //0부터 시작
    //           folder: path.basename(filepath),
    //           file: fileitem

    //         });

    //         this.logger.debug('GET, NPKI ***********', folderSize);
    //         this.notification.next({
    //           cmd: 'FOLDER.INFO',
    //           folderData: {
    //             index: this.folderIndex,
    //             size: folderSize
    //           }
    //         });

            
    //     } else{
    //       if(fileTree.length == undefined){
    //         console.log('백업할 파일이 없음');
    //         log.info('백업할 파일이 없음');
    //         this.notification.next({cmd: 'LOG', message: '백업할 파일이 없습니다.'});
    //         this.gotoNextFile(this.folderIndex); //선택된 폴더의 index
    //         return; 
    //       }
          
    //       fileTree.forEach(element => {
    //         console.log('fileTree => element = ',element);
    //         folderSize += this.processTreeElement(this.folderIndex, element);
  
    //       });

         

    //       //this.logger.debug('GETFOLDERTREE***********', folderSize);
    //       //log.ingo('folderSize = ',folderSize);

    //       // this.notification.next({
    //       //   cmd: 'FOLDER.INFO',
    //       //   folderData: {
    //       //     index: this.folderIndex,
    //       //     size: folderSize
    //       //   }
    //       // });
    //     }


    //     console.log('GETFOLDERTREE***********', folderSize);
    //     this.notification.next({
    //       cmd: 'FOLDER.INFO',
    //       folderData: {
    //         index: this.folderIndex,
    //         size: folderSize
    //       }
    //     });


    //     /*----------------------------------------------------
    //       *  이상있는 파일 체크
    //       ----------------------------------------------------*/
    //     let foundDataBackup = false;
    //     let zipFound = false;
    //     let minDiff = -1000;
    //     let maxDate = moment().year(1990).month(0).date(1);
    //     //console.log('upload.filetree, 기준시간?? ', maxDate);
    //     const fileSortList = [];
    //     const folderSortList = [];

    //     // 최근 5개 계산을 위한 정렬용 배열에 채워넣는다.
    //    // console.log('upload.filetree, filesToSend?? ', this.filesToSend);
    //     for (const f in this.filesToSend) {
    //       if (this.filesToSend.hasOwnProperty(f)) {
    //         console.log('filesToSend hasOwnProperty 가 있다.this.filesToSend[f] = ', this.filesToSend[f]);
    //         const fileItem = this.filesToSend[f];

    //         const folderName = path.dirname(fileItem.file.fullpath);
    //         const paths = folderName.split(path.sep);
    //         console.log('folderName = ',folderName,'paths = ',paths);
    //         if (paths[paths.length - 1].toLowerCase().indexOf('data_backup') >= 0) { //데이터백업폴더명(대소문자는조금씩다름): DATA_BACKUP
    //           console.log('백업폴더가 있다');
    //           foundDataBackup = true;
    //           const filename = fileItem.file.filename;
    //           const fyyyy = Number(filename.substr(0, 4));
    //           const fmm = Number(filename.substr(4, 2));
    //           const fdd = Number(filename.substr(6, 2));
    //           const fdate = moment([fyyyy, fmm - 1, fdd]);
    //           console.log('fileItem = ',fileItem);
    //           console.log('fdate = ',fdate);
    //           if (fdate.isValid()) {  //fdate가 시간문자열형태라면 참

    //             console.log('fileItem.file.type = ',fileItem.file.type);
    //             console.log('filename = ',filename);
    //             if (fileItem.file.type === 'file') {
    //               console.log('data_backup/파일');
    //               if (filename.toLowerCase().indexOf('.zip') > 0) {
    //                 console.log('data_backup/zip파일');
    //                 zipFound = true;
    //                 fileItem.sortDate = fdate;
    //                 fileSortList.push(fileItem);  //zip파일이 발견되면 증가함
    //                 if (maxDate.isBefore(fdate)) {
    //                   console.log('maxDate 변경');
    //                   maxDate = fdate;
    //                 }else{
    //                   console.log('maxDate 변경안함');
    //                 }
    //               }
    //               // else{
    //               //   console.log('data_backup/zip파일이 아님');
    //               // }
    //             } else if (fileItem.file.type === 'folder') {
    //               console.log('data_backup/서브폴더');
    //               fileItem.sortDate = fdate;
    //               folderSortList.push(fileItem);
    //               // if (maxDate.isBefore(fdate)) {
    //               //   maxDate = fdate;
    //               // }
    //             }
    //           }else{
    //             console.log('fdate false  ');
    //           }
    //         }
    //       }
    //     }
    //     console.log('upload.filetree 길이 = ',fileSortList.length);
    //     if (fileSortList.length > 5) {
    //       console.log('5개이상  ');
    //       fileSortList.sort((a, b) => {  //소팅을 해서 가장 최근것만 올리게 ..
    //         if (a.sortDate.isBefore(b.sortDate)) {
    //           console.log('시간이 이전');
    //           return 1;
    //         } else if (a.sortDate.isSame(b.sortDate)) {
    //           console.log('시간이 동일');
    //           return 0;
    //         } else {
    //           return -1;
    //         }
    //       });

    //       for (let f = 5; f < fileSortList.length; f++) {
    //         console.log('upload.filetree , 11..파일업로드 안함, fileSortList[f] = ',f, fileSortList[f])
    //         fileSortList[f].doNotSend = true;  //파일업로드 안함, 업로드 안할놈은 배열의 5번째 이후임
    //       }
    //     }
    //     console.log('upload.filetree , 정렬된 값, fileSortList = ',fileSortList);
    //     //kimcy 동일한 루틴이라 삭제
    //     // if (folderSortList.length > 5) {
    //     //   folderSortList.sort((a, b) => {
    //     //     if (a.sortDate.isBefore(b.sortDate)) {
    //     //       return 1;
    //     //     } else if (a.sortDate.isSame(b.sortDate)) {
    //     //       return 0;
    //     //     } else {
    //     //       return -1;
    //     //     }
    //     //   });

    //     //   for (let f = 5; f < folderSortList.length; f++) {
    //     //     console.log('upload.filetree , 22..파일업로드 안함, fileSortList[f] = ',f, fileSortList[f])
    //     //     folderSortList[f].doNotSend = true;  //폴더업로드 안함
    //     //   }
    //     // }

    //     //console.log('uplaod.filetree, FILESORT', fileSortList);


    //     const dataBackupItem = this.folders[response.folderIndex];
    //     console.log('upload.filetree foundDataBackup = ', foundDataBackup, 'folderIndex = ',this.folderIndex);
    //     console.log('dataBackupItem = ',dataBackupItem, 'response.folderIndex = ',response.folderIndex);
    //     if (foundDataBackup === true && this.folderIndex < 2) {
    //       minDiff = moment().diff(maxDate, 'days') + 1;
    //       this.logger.debug('STARTCHECK', minDiff);
    //       //에러 저장 : 폴더1, 폴더2에 대해서만 체크
    //       if (dataBackupItem != null) {
    //         let message = '';
    //         if (minDiff >= 10) {
    //           dataBackupItem.error = '10days';
    //           message = '[폴더' + (this.folderIndex + 1) + '] 10일간 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
    //           // this.electronService.ipcRenderer.send('ALERT', {message: message});
    //         } else if (minDiff >= 5) {
    //           dataBackupItem.error = '5days';
    //           message = '[폴더' + (this.folderIndex + 1) + '] 5일간 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
    //           // this.electronService.ipcRenderer.send('ALERT', {message: message});
    //         }
    //         if (zipFound === false) {
    //           dataBackupItem.error = 'nozip';
    //           message = '[폴더' + (this.folderIndex + 1) + '] 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
    //           // this.electronService.ipcRenderer.send('ALERT', {message: message});
    //         }
    //       }
    //     }
    //     /*----------------------------------------------------
    //      *  이상유무를 서버에 저장
    //      *---------------------------------------------------*/
    //     //console.log('이상유무를 서버에 저장');
    //     // dataBackupItem.lastUploaded = moment().unix() * 1000;
    //     // dataBackupItem.lastZip = maxDate.unix() * 1000;
    //     // dataBackupItem.count = folderSize;
    //     // dataBackupItem.deviceResource = this.deviceResource;

    //     //this.member = this.memberAPI.isLoggedin();

    //     //console.log('33..맴버 = ',this.member);
    //     //console.log('로그인되어있는지 보고');
    //     //kimcy 추후.
    //     // this.memberAPI.detail(this.member).subscribe(res => {
    //     //   this.logger.debug('##MEMBER', res.member);
    //     //   this.member = res.member;
    //     //   this.memberAPI.updateFolderData(dataBackupItem, this.member).subscribe(updateRes => {
    //     //       {
    //     //         console.log('upload.filetree updateFolderData 성공');
    //     //         this.logger.debug(updateRes);
    //     //       }
    //     //     },
    //     //     error => {
    //     //       console.log('upload.filetree updateFolderData 실패');
    //     //       this.logger.debug(error);
    //     //     }
    //     //   );
    //     // });

    //     console.log('deviceResource = ',this.deviceResource);
    //     if (this.deviceResource == null) {
    //       this.deviceResource = {
    //         macaddress: 'MAC'
    //       };
    //     }
        
    //     //kimcy: dataBackupItem 이란? 마지막 업로드. 에러(10일, 5일, nozip), 마지막zip, count, 디바이스리소스
    //     dataBackupItem.version = environment.VERSION;

    //     console.log('dataBackupItem.version = ',dataBackupItem.version);
    //     console.log('processFile 호출?? 해야지.. ');
    //     this.subject.next(this.filesToSend[0]); //processFile 호출??
    //   }
    // );

    
    /*----------------------------------------------------
     *  IPC Response : Send File Response
     *  다음 파일을 보내도록 next에 밀어넣기
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('SENDFILE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음, upload.filetree, SENDFILE '); //main에서 업로드 완료된 후
      this.logger.debug('FILE', response, this.filesToSend);
      let message = '';
      console.log(response);
      if(response.error === null ){
        //kimcy 블록체인에 기록
        console.log('블록 => path = ', response.uploadPath);
        console.log('블록 => username = ', this.member.username);
        var path = response.uploadPath;
        var index = response.index;
        var noti = this.notification;
        
        console.log('response.chain = ',response.chain);
         if(this.member.private == false){  //블록체인에 기록
          // if(this.storageService.get('createProof') != undefined){
          //   path = this.storageService.get('createProof');  //문제된 넘 부터 올리게..
          // }else{
          //   this.storageService.set('createProof', path);
          // }
          // this.gotoNextFile(index);
          
          if(response.chain === 'chain-create'){
            //서버에 올라가 있고 블록체인에 없는 파일은 먼저 업로드 해야 한다. 블록체인 리셋후 싱크 맞추기 위해
            if(this.storageService.get('createProof') != undefined){
              path = this.storageService.get('createProof');  //문제된 넘 부터 올리게..
              console.log('체인 업로드 에러시작 = ',path);
            }else{
              this.storageService.set('createProof', path);
            }

            console.log('체인 업로드 패스 = ',path);

            this.postAPI.createProof(M5MemberService.create,this.member, path, index, noti).subscribe(
              response => {
  
                console.log('성공');
                let chainArray = new Array();
                var str = {name : path, status: true};
                var jsonStr = JSON.stringify(str);
                console.log('jsonStr = ',jsonStr);
  
                if(this.storageService.get('chain') == undefined){
                  console.log('맨처음');
                  chainArray.push(JSON.parse(jsonStr));
                  this.storageService.set('chain', chainArray); 
                }else{
                  console.log('덫붙이기 chainArray = ',chainArray);
                  chainArray = this.storageService.get('chain');
                  chainArray.push(JSON.parse(jsonStr));
                  this.storageService.set('chain', chainArray); 
                }
               
                this.storageService.remove('createProof'); //에러가 없음으로 해당 파일을 지운다.

                var message = ' : 파일 업로드 완료 (' + (index + 1) + '/' + this.filesToSend.length + ')';
                console.log(message);
                //메세지를 뿌릴려고..
                noti.next({
                  cmd: 'LOG',
                  message: '[' + (index + 1) + '] ' + message
                });
                this.gotoNextFile(index);
              },
              error => {
                var str = {name : path, status: false};
                this.uploading = false;
                console.log('실패');
                //var message = ' : 블록체인에 에러가 발생했습니다.  (' + (index + 1) + '/' + decodeURI(path) + ')';
                // var message = ' : 파일 업로드 실패(0000)'+ decodeURI(path);
                // console.log(message);
                // //메세지를 뿌릴려고..
                // noti.next({
                //   cmd: 'LOG',
                //   message: '[' + (index + 1) + '] ' + message
                // });
              }
            );;
          }else if(response.chain === 'chain-update'){
            this.postAPI.updateProof(M5MemberService.update,this.member, path, index, noti).subscribe(
              response => {
  
                console.log('성공');
                let chainArray = new Array();
                var str = {name : path, status: true};
                var jsonStr = JSON.stringify(str);
                console.log('jsonStr = ',jsonStr);
  
                if(this.storageService.get('chain') == undefined){
                  console.log('맨처음');
                  chainArray.push(JSON.parse(jsonStr));
                  this.storageService.set('chain', chainArray); 
                }else{
                  console.log('덫붙이기 chainArray = ',chainArray);
                  chainArray = this.storageService.get('chain');
                  chainArray.push(JSON.parse(jsonStr));
                  this.storageService.set('chain', chainArray); 
                }
  
                var message = ' : 파일 업로드 완료 (' + (index + 1) + '/' + this.filesToSend.length + ')';
                //console.log(message);
                //메세지를 뿌릴려고..
                noti.next({
                  cmd: 'LOG',
                  message: '[' + (index + 1) + '] ' + message
                });
                this.gotoNextFile(index);
              },
              error => {
                var str = {name : path, status: false};
                this.uploading = false; //이렇게 해주면 다시 업로드 버튼을 누를때 올라가는 것처럼 보임
                console.log('실패');
                //var message = ' : 블록체인에 에러가 발생했습니다.(' + (index + 1) + '/' + decodeURI(path) + ')';
                //var message = ' : 파일 업로드 실패(0000)'+ decodeURI(path);
                //console.log(message);
                //메세지를 뿌릴려고..
                // noti.next({
                //   cmd: 'LOG',
                //   message: '[' + (index + 1) + '] ' + message
                // });
              }
            );;
          }
          
         } else {
          //블록체인에 기록하지 않음
          message = ' : 파일 업로드 완료 (' + (this.folderIndex + 1) + '/' + this.filesToSend.length + ')';
          console.log(message);
          //메세지를 뿌릴려고.
          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + message
          });
          this.gotoNextFile(response.index);

        }

      }else{
        message = ' : 파일 업로드 실패 , 다음파일을 업로드 합니다.';
        console.log(message, this.filesToSend[response.index]);
        this.notification.next({
             cmd: 'LOG',
             //message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[response.index].file.filename + message
             message: '[' + (this.folderIndex + 1) + '] ' +  message
          });

        this.gotoNextFile(response.index);
      }
    });
  }

 

  private requestChainErrorList(){
    console.log('블록체인 업로드 실패 목록 요청');
    console.log('선택된 폴더 = ', this.folders[this.folderIndex]);


    this.electronService.ipcRenderer.send('REQ-CHAINTREE', {
      folderIndex: this.folderIndex
    });


    this.electronService.ipcRenderer.on('CHAINTREE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음 CHAINTREE ');
      const fileTree = response.tree; 
      // console.log('fileTree 타입 = ', typeof fileTree);
      // console.log('fileTree 갯수 = ', fileTree.length);
      //const code = file.fullpath.replace(/\\/g, '/');  //비교대상
      //메모리 줄일려고 filepath만
      this.filesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.filesToSend.push({
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+fileTree[i]['filename'].replace(/\\/g, '/')
        });
      }

      console.log('filesToSend = ',this.filesToSend);

    });
  }

  private requestUploadList(){
    console.log('업로드 목록 요청');
    console.log('선택된 폴더 = ', this.folders[this.folderIndex]);

    this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
      folderIndex: this.folderIndex
    });


    this.electronService.ipcRenderer.on('UPLOADTREE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음 UPLOADTREE ');
      const fileTree = response.tree; 
      // console.log('fileTree 타입 = ', typeof fileTree);
      // console.log('fileTree 갯수 = ', fileTree.length);
      //const code = file.fullpath.replace(/\\/g, '/');  //비교대상
      //메모리 줄일려고 filepath만
      this.filesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.filesToSend.push({
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+fileTree[i]['filename'].replace(/\\/g, '/')
        });
      }
      
      console.log('filesToSend = ',this.filesToSend);

    });
  }

  private requestUpdateList(){
    console.log('업데이트 요청');
    console.log('선택된 폴더 = ', this.folders[this.folderIndex]);

    this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
      folderIndex: this.folderIndex
    });


    this.electronService.ipcRenderer.on('UPDATETREE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음 UPDATETREE ');
      const fileTree = response.tree; 
      // console.log('fileTree 타입 = ', typeof fileTree);
      // console.log('fileTree 갯수 = ', fileTree.length);
      //const code = file.fullpath.replace(/\\/g, '/');  //비교대상
      //메모리 줄일려고 filepath만
      this.filesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.filesToSend.push({
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+fileTree[i]['filename'].replace(/\\/g, '/')
        });
      }
      
      console.log('filesToSend = ',this.filesToSend);

    });
  }

  //스토리지에 저장된 폴더의 키를 반환한다.
  private getFolderKey(folderIndex) {
    // if (this.member == null) {
    //   this.member = this.memberAPI.isLoggedin();
    //   console.log('bb 맴버 = ',this.member);
    // }

    this.member = this.memberAPI.isLoggedin();

    console.log('getFolderKey => 맴버 ', this.member);

    return 'folder:' + this.member.username + ':' + folderIndex;
  }

  //kimcy
  getContainerList(storage, callback){
   
     console.log('getContainerList');
     var list = "";
     this.member = storage.get('member');
     console.log('44..맴버 = ',this.member);
    if(this.member == undefined){
      console.log('이경우는 어딜까??')
      return callback(false);
    }
    const token = this.member.token;
    var contaniername = this.member.username.replace(/"/g, '').replace(/"/g, '');
    var getObjListPromise = getObjList(contaniername, token,  "", list)
    //console.log('getObjListPromise = ', typeof getObjListPromise);

    getObjListPromise.then(function(result){

      console.log('결과 = ', result);
      storage.set('list',result);
      return callback(true);
    },function(error){
      console.log('목록가져오기 실패 = ',error);
      return callback(false);
    });
    //var initializePromise = this.initialize(contaniername, this.member.token);

    // initializePromise.then(function(result) {
    //    if(result === 'again'){
    //       var againMember = storage.get('member');
    //       var againContanier = againMember.username.replace(/"/g, '').replace(/"/g, '');
    //       var againToken = againMember.token;
    //       var options = {
    //         uri: M5MemberService.s3Storage+'/'+againContanier+'?format=json',
    //         headers: {
    //           'X-Auth-Token': againToken
    //         }
    //       };
    //       request.get(options, function(err, resp, body) {
  
    //           if(resp.statusCode == 200){
    //             console.log('2번째 목록얻어오기 성공');
    //             console.log(body);
    //             //resolve([resp.headers,body]);  //배열로 멀티값전달
    //             //storage.set('list',body);
    //           }else if(resp.statusCode == 204){
    //           console.log('처음 목록얻어오기 성공');
    //           storage.set('list',"No Content");
    //           }else{
    //               console.log('2번째 목록얻어오기 실패 = ',err);
    //           }
    //       });

    //    }else if(result === "No Content"){
    //     storage.set('list',result);
    //    // console.log("11..결과 body :",storage.get('list'));
    //     return callback(true);
    //    } else{
    //       if(result[0] <= PAGE_COUNT){
    //         console.log('result[1] = ',result[1]);
    //         storage.set('list',result[1]);
    //         return callback(true);;
    //       }else{

    //       }
    //    }

    // }, function(err) {
    //     console.log(err);
    //     return callback(false);

    // })

  }


  public setUploadingStatus(set){
    this.uploading = set;
  }

  public setUploadMember(set){
    this.member = set;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Process Tree to File list to send
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private processTreeElement(folderIndex, fileItem) {
    console.log('uppload.filetree, processTreeElement => folderIndex :',folderIndex);
    console.log('fileItem :',fileItem); //하나의 파일
    console.log('fileItem 타입 :',fileItem.type); //하나의 파일
    console.log('filesToSend :',this.filesToSend);  //어디서 값을 넣어줬을끼?, 현재는 배열로 폴더에 있는 파일들을 가르킨다.
    let size = 0;
    this.test ++;
    console.log('test = ',this.test);

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

      // const used1 = process.memoryUsage().heapUsed / 1024 / 1024;
      // console.log(`22 ..The script uses approximately ${Math.round(used1 * 100) / 100} MB`);
      return size;

    } else if (fileItem.type === 'file') {
      /*---------------------------------------------------------------
       * 파일
       *---------------------------------------------------------------*/
      this.filesToSend.push({
        folderIndex: folderIndex,
        index: this.filesToSend.length,
        folder: path.basename(fileItem.fullpath),
        file: fileItem
      });

      // const used = process.memoryUsage().heapUsed / 1024 / 1024;
      // console.log(`11..The script uses approximately ${Math.round(used * 100) / 100} MB`);
      size += fileItem.size;
    }
    return size;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  다음 파일 보내기
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private gotoNextFile(index) {
    //index는 폴더 인덱스
    log.warn('gotoNextFile , 파일갯수 : ', this.filesToSend.length);
    log.warn('gotoNextFile , filesToSend 사이즈 : ', this.filesToSend);
    log.warn('gotoNextFile, 폴더인덱스 : ', index);  //process.getHeapStatistics().usedHeapSize

    //console.log('gotoNextFile filesToSend 사이즈 = ',this.filesToSend.length,'index= ',index);


    console.log('gotoNextFile send = ',this.filesToSend.length,'index= ',index);
    //log.warn()
    if (this.filesToSend.length - 1 > index) { //폴더갯수와 현재 폴더를 비교하여 다음폴더 진행
      this.subject.next(this.filesToSend[index + 1]); //processFile 호출
    } else {
      console.log('업로드 종료');
      log.warn('gotoNextFile, 업로드 종료 : ', index);
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

  private gotoNextFileChain(index,result) {
    //console.log('gotoNextFile send = ',this.filesToSend.length,'index= ',index);
    console.log('result = ',result);
    if (this.filesToSend.length - 1 > index && request) {
      console.log('성공한경우');
      this.subject.next(this.filesToSend[index + 1]);
    } else if(this.filesToSend.length - 1 > index && !request){
      console.log('성공한실패한경우');
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
    log.info('processFile, 업로드 프로세스 시작 사이즈 = ', item.length);
    log.info('processFile, item : ',item , 'this.folders[item.folderIndex].path : ',this.folders[item.folderIndex].path);
    if (item == null || this.folders[item.folderIndex].path === undefined) {  //this.folders[item.folderIndex].path: 설정한 업로드패스
      return;
    }
    //this.logger.debug('===', item);
    console.log('===', item);
    const file = item.file;
    let post;
    this.member = this.memberAPI.isLoggedin();
   //console.log('55..맴버 = ',this.member);
    console.log('업로드 file: ',file);
    /*---------------------------------------------------------------
        폴더도 Post를 하나 추가해놓아야함
     ----------------------------------------------------------------*/

    const paths = path.dirname(file.fullpath).split(path.sep);  //fullpath를 /로 분리하여 저장
    //console.log('업로드 paths: ',paths);  
    const parentPath = (paths.slice(0, paths.length).join(path.sep)).replace(/\\/g, '/');
   //console.log('업로드 parentPath: ',parentPath);
    const folderName = this.folders[item.folderIndex].path.replace(/\\/g, '/');
    //console.log('업로드 folderName: ',folderName);
    const code = file.fullpath.replace(/\\/g, '/');  //비교대상
    //console.log('업로드 code: ',code);
    const deviceId = this.deviceResource.macaddress;

    let userToken = this.member.token;
    let username = this.member.username;

    if (item.file.type === 'folder') {
      let uertoken = 
      post = {
        index: item.index,
        file: file,
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.deviceResource.macaddress + '/' + code,                                   // 파일의 fullpath
          subtitle: code,
          checkCode: 'true',
          checkCodeAction: 'update',
          userData: {
            parentPath: parentPath,
            totalSize: item.size,
            // created: file.created,
            // updated: file.updated,
            // accessed: file.accessed,
          }
        },
        accessToken: userToken,
        username:username,
      };
    } else {
     // console.log('file  타입: ',this.storageService.get('userToken'));
      post = {
        index: item.index,
        file: file,
        formData: {
          type: 'item',
          categories: [parentPath],                     // 파일이 포함된 path
          subtype: file.type,
          title: file.filename,
          status: folderName,                           // 사용자가 선택한 폴더
          code: this.deviceResource.macaddress + '/' + code,                                   
          subtitle: code,
          checkCode: 'true',
          checkCodeAction: 'create',  
          chain:'create',
          userData: {
            parentPath: parentPath,
            totalSize: file.size,
            // created: file.created,
            // updated: file.updated,
            // accessed: file.accessed,
          }
        },
        accessToken: userToken,
        username:username,
      };
    }

    /*---------------------------------------------------------------
          이미 존재하는지 체크, 
        ----------------------------------------------------------------*/
    //공용과 블록체인을 나워야...
    let existPost = null;
    var listObj = this.storageService.get('list');
    log.warn('listObj = ',listObj);
    //console.log('upload.filetree, 리스트목록 = ',listObj);
   // console.log('리스트목록 갯수 = ',listObj.length);
    if(listObj != '[]' && listObj != 'No Content' && file.type != 'folder' 
       && listObj != undefined){
      let jsonExitPost = JSON.parse(listObj);
      // console.log('json, 리스트목록  = ',jsonExitPost);
       console.log('리스트목록 갯수 = ',jsonExitPost.length);
       log.info('리스트목록 갯수 = ',jsonExitPost.length);
      // console.log('deviceId = ',deviceId);
     // console.log('item.name = ',item.name);


     console.log('deviceId = ',deviceId);

      let diffJsonPost = jsonExitPost.filter(function (item){
           console.log('item = ',item);
           return item.name.startsWith(deviceId);
           
      });
     // process.takeHeapSnapshot('/Users/kimcy/dev/SafeBackUp')

      //log.warn(process.getHeapStatistics());
      
      //log.warn('listObj = ', listObj);
      //log.warn('jsonExitPost = ', listObj);
      listObj = null;
      jsonExitPost = null;

      console.log('diffJsonPost = ',diffJsonPost);
      console.log('post.formData.code = ',post.formData.code);
      for(var ele in diffJsonPost){
        if(diffJsonPost[ele].name === post.formData.code){
          if(diffJsonPost[ele].bytes === file.size){
            existPost = 'already-exists';
            //console.log('업데이트된 파일');
            diffJsonPost.splice(ele,1);
            var list = JSON.stringify(diffJsonPost);
            //console.log('list = ', list);
            this.storageService.set('list',list);
            break;
          }else if(diffJsonPost[ele].bytes != file.size){
            //파일 이름은 같은데 파일사이즈가 다르면 신규파일이지만 블록체인에는 update로 기록해야 한다.
            existPost = 'need-update';
          }
        }
      }

      diffJsonPost = null;

      //2. 목록 안지우고 비교
      // for(var ele in jsonExitPost){
      //   //동일한 이름값이면 filesize체크해서 변경유무 파악
      //   // console.log('목록있음,,,jsonExitPost[ele].name = ',ele, jsonExitPost[ele].name);
      //    console.log('한글 = ', code);
      //   if(jsonExitPost[ele].name === post.formData.code){
      //     if(jsonExitPost[ele].bytes === file.size){
      //       existPost = 'update-already';
      //       console.log('업데이트된 파일');
      //       jsonExitPost.splice(ele,1);
      //       var list = JSON.stringify(jsonExitPost);
      //       console.log('list = ', list);
      //       this.storageService.set('list',list);
      //       break;
      //     }
      //   }
      // }
    }else if(listObj === '[]' || listObj === 'No Content'){
      console.log('맨 처음 올리는것임');
      log.info('processFile, 맨 처음 업로드');
    }else{
      console.log('에러 => 처음부터 다시 올림?? 맞나??');
      log.error('processFile, 에러발생');
    }

    


    /*---------------------------------------------------------------
        업로드 제외 파일
      ----------------------------------------------------------------*/
    //data_backup/zip파일을 날짜별로 소팅해서 오래된것에는 doNotSend flag를 셋팅했음
    if (this.filesToSend[item.index].doNotSend === true) {
      log.info('processFile, data_backup의 zip파일중 예전데이터 처리');
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
        //console.log('upload.filetree, item.index = ',item.index);
        log.info('processFile, data_backup의 zip파일 처리, 다음파일 : ',item.index);
        this.gotoNextFile(item.index);
      }

    }
    /*---------------------------------------------------------------
        업로드해야할 파일 판단, 업로드 시작
      ----------------------------------------------------------------*/
    else {

      console.log('업로드 해야 할 파일 판단, 업로드 시작',  code);
      log.warn('processFile, 업로드해야할 파일 처리 code : ',code);
      if (existPost == null && file.type != 'folder') {
        const pipe = new BytesPipe();
        const size = pipe.transform(this.filesToSend[item.index].file.size);
        this.notification.next({
          cmd: 'SENDING.STARTED',
          message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
        });
        // console.log('보냄, upload.filetree, SENDFILE ');
        //  console.log('보냄, code =  ', post.formData.code);
        //  console.log('보냄, code11 =  ', post.formData.code.replace(/\\/g, '/'));
        log.warn('processFile, 신규파일 업로드 : ',post.formData.code);
         post.formData.chain = 'chain-create';
        this.electronService.ipcRenderer.send('SENDFILE', post);
      } else if(existPost === 'need-update'){
        const pipe = new BytesPipe();
        const size = pipe.transform(this.filesToSend[item.index].file.size);
        this.notification.next({
          cmd: 'SENDING.STARTED',
          message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
        });
        log.warn('processFile, 변경파일 업로드 : ',post.formData.code);
        post.formData.chain = 'chain-update';  //블록체인
        this.electronService.ipcRenderer.send('SENDFILE', post);
      } else if(existPost == null && file.type === 'folder'){
        console.log('폴더는 업로드 하지 않음');
        log.warn('processFile, 폴더는 업로드 제외 ',post.formData.code);
        this.gotoNextFile(item.index);
      } else {
        //이미 있는 파일인데 무슨이유에서인지 블록체인에는 없는 파일(둘다올림?)
        console.log('chain , post.formData.code =',post.formData.code);
        // if(existPost === 'already-exists'){
        //   var jsonChainPost = this.storageService.get('chain');
        //   console.log('chainObj = ',jsonChainPost);
        //   for(var ele in jsonChainPost){
        //     if(jsonChainPost[ele].name === post.formData.code){
        //       existPost = 'already-exists'
        //       console.log('체인에 있음 ');
        //       break;
        //     }else{
        //       console.log('체인에 없음 ');
        //       existPost = null;
        //     }
        //   }
        // }

       // jsonChainPost = null;

        // if (existPost == null && file.type != 'folder'){
        //   console.log('체인에 없어서 다시 보냄');
        //   const pipe = new BytesPipe();
        //   const size = pipe.transform(this.filesToSend[item.index].file.size);
        //   this.notification.next({
        //     cmd: 'SENDING.STARTED',
        //     message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
        //   });
        //   console.log('chain, 보냄, upload.filetree, SENDFILE ');
        //    console.log('chain, 보냄, code =  ', post.formData.code);
        //    console.log('chain, 보냄, code11 =  ', post.formData.code.replace(/\\/g, '/'));
        //    //post.formData.chain = 'chain-create';
        //    post.formData.chain = 'chain-create'; //이경우는 update록..
        //   this.electronService.ipcRenderer.send('SENDFILE', post);
        // }else
        
        {
          //블록체인에도 있고 서버에도 있는 경우
          //this.logger.debug('이미 업로드된 파일', code);
          log.warn('이미 업로드된 파일', code);
          const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' (' + (item.index + 1) + '/' + this.filesToSend.length + ')';
          this.notification.next({
            cmd: 'LOG',
            message: message + ' : 이미 업로드된 파일입니다. ' // + response.posts[0].id
          });
          log.warn('다음 파일', item.index);
          this.gotoNextFile(item.index);
        }
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
    //일단 임시..kimcy
    // if (this.uploading === true) {
    //   console.log('업로딩중이라 리턴');
    //   return;
    // }
    // if(fullpath == undefined){
    //   this.fillFollders();

    //   console.log('33..폴더가 ', this.folders);
    // }

    this.fillFollders();
    
    console.log('folders[folderIndex] =  ', this.folders[folderIndex]);
    if (this.folders[folderIndex] == null) {
      //console.log('폴더가 null');
      this.folders[folderIndex] = [];
     // console.log('11..폴더가 ', this.folders[folderIndex]);
    }

    //console.log('22..폴더가 ', this.folders);
    console.log('this.folders[folderIndex].path = ',this.folders[folderIndex].path);
    if (this.folders[folderIndex].path === undefined) {
      this.uploading = false;
      if (this.electronService.isElectronApp) {
        //kimcy: 지정되지 않음이 계속나와 this.folderIndex를 +1시킴 -> 다음폴더이동, 했더니 문제가 있어서 원복
        if(this.member == null){
          this.member = this.memberAPI.isLoggedin();
        }
        console.log('cc.. 맴버 = ',this.member);
        if(this.member.private){
          console.log('private. folderIndex = ',folderIndex);
          if(folderIndex > 0){
            this.notification.next({
              cmd: 'FOLDER.SENT',
              folderIndex:  folderIndex //this.folderIndex
            });
          }else{
            this.notification.next({cmd: 'LOG', message: '폴더' + (folderIndex + 1) + '는 지정 되지 않았습니다.'});
            this.notification.next({
              cmd: 'FOLDER.SENT',
              folderIndex:  folderIndex //this.folderIndex
            });
          }
          
        }else{
          console.log('public, folderIndex = ',folderIndex);
          if( /*folderIndex >=  1*/folderIndex ==  2){
            this.notification.next({
              cmd: 'FOLDER.SENT',
              folderIndex: folderIndex //this.folderIndex
            });
          }else{
            console.log('폴더 지정,,folderIndex = ',folderIndex, );
            this.notification.next({cmd: 'LOG', message: '폴더' + (folderIndex + 1) + '는 지정 되지 않았습니다.'});
            this.notification.next({
              cmd: 'FOLDER.SENT',
              folderIndex:  folderIndex //this.folderIndex
            });
          }
        }
      }
    } else{
      console.log('99.. 맴버 = ',this.member);
      if(this.member == null){ //로그아웃후 로그인
         this.member = this.memberAPI.isLoggedin();
      }
      console.log('00.. 맴버 = ',this.member);
      this.postAPI.getNewToken(M5MemberService.login, this.member).subscribe(
        response => {
          this.member.token = response;
          console.log('77.. 맴버 = ',this.member);
          this.storageService.set('member',this.member);
          console.log("신규토큰 ,,member :",this.storageService.get('member'));
  
          this.getContainerList(this.storageService, (result)=>{
            if(result == true){
              this.initUpLoad(folderIndex, fullpath)
            }else{
              console.log('목록을 가져오지 못했음'); //이 경우 다시 처음부터 올려야 하나? 그럴경우 블록체인에서 에러 나옴..
              this.notification.next({cmd: 'LOG', message: 'KT서버 응답을 받지 못했습니다. 다시 로그인하세요'});
            }
          });
  
        },
        error => {
          console.log('업로딩 시작, 토큰갱신 못함');
          this.notification.next({cmd: 'LOG', message: 'KT서버 응답을 받지 못했습니다. 다시 로그인하세요'});
        }
      );
    }

  }

  initUpLoad(folderIndex,fullpath){
    this.uploading = true;
    this.folderIndex = folderIndex;
    this.folders[folderIndex].path = fullpath;
    if (this.electronService.isElectronApp) { //앱이 실행중이라면..
      console.log('11..upload ->앱이실행중이라 업로드');
      this.notification.next({cmd: 'LOG', message: this.folders[folderIndex].path + ' 업로드를 시작합니다.'});
      console.log('보냄, GETFOLDERTREE, upload-filetree');
      //path: this.folders[folderIndex].path 설정안됨
      console.log('선택된 폴더 = ', this.folders[folderIndex]);
      this.electronService.ipcRenderer.send('GETFOLDERTREE', {
        folderIndex: folderIndex,
        path: this.folders[folderIndex].path
      });
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
