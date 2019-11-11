import {Inject, Injectable, OnDestroy, OnInit} from '@angular/core';
import {M5MemberService} from './m5/m5.member.service';
import {M5PostService} from './m5/m5.post.service';

import {ElectronService} from 'ngx-electron';
import {LOCAL_STORAGE, StorageService, StorageTranscoders} from 'ngx-webstorage-service';

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
const zipper = require('zip-local');


//  function getObjList(containername, token,  marker, list) {
    
    
//   // console.log('lnitObjList = ',containername, 'token = ',token,
//   //             'marker = ',marker,'list = ',list);
              
//   var options = {
//       uri: M5MemberService.s3Storage+'/'+containername+'?format=json'
//            +'&limit='+1000+'&marker='+marker,
//       headers: {
//         'X-Auth-Token': token
//       }
//   };
//   // Return new promise 
//   return new Promise(function(resolve, reject) {
//     // Do async job
//       request.get(options, function(error, response, body) {
//         if (!error && (response.statusCode == 200)){
//           var objCountInContainer = parseInt(response.headers['x-container-object-count']);
//           console.log("목록 : count : " + objCountInContainer);

//           if(objCountInContainer <= 1000) {
//             // one time
//             resolve(body);
//           }else {
//             var partiallist;
            
//             list += body;
//             list = list.replace("][", ",").replace(",]", "]");
//             console.log('1000개 이상 = ',list);
//             partiallist = JSON.parse(body);

//             if(partiallist.length == 0) {
//               // console.log("file list : " + list);
//               partiallist = JSON.parse(list);
//               console.log("my file list count : " + partiallist.length);
//               resolve(list);
//             }
//             else {
//               marker = partiallist[partiallist.length-1].name; // the last
//               console.log('재귀함수 호출');
//               resolve(getObjList(containername, token, marker, list));
//               //console.log('this = ', typeof this);
//               //resolve(['recursive', marker, list, this]);
//             }
//           }
//         }else if (!error && (response.statusCode == 404 || response.statusCode == 204)) {
//             resolve(list);
//         }else{
//           reject(error);
//         } 
//       });
//   });
// }


@Injectable()
export class UploadFiletreeService {

  //private folders; 사용안함.
  private subscription;
  private subject;
  private filesToSend;

  //kimcy : 기존 변수 대신사용
  private chainsToSend;
  private addfilesToSend;
  private changefilesToSend;
  private sendIndex;

  private folderIndex;
  private deviceResource;
  private board;
  private member;
  private accessToken;

  private uploading = false;
  private notification;





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

    //this.fillFollders();
   
    //this.board = this.storageService.get('board');
    //this.accessToken = this.storageService.get('accessToken');

    this.notification = new Subject();
    this.subject = new Subject();
    //this.subscription = this.subject.subscribe(response => this.processFile(response));

    /*----------------------------------------------------
     *  IPC Response : Get FileTree
     ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('PCRESOURCE', (event: Electron.IpcMessageEvent, response: any) => {
      this.deviceResource = response;
      console.log('받음 upload.filetree, PCRESOURCE 디바이스 = ',this.deviceResource);
    });

    /*----------------------------------------------------
       *  IPC Response : Get FileTree
       사용안함
       ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('SENDING.PROGRESS', (event: Electron.IpcMessageEvent, response: any) => {

      this.notification.next({
        cmd: 'SENDING.PROGRESS',
        message: response.percent
      });
    });




    /*----------------------------------------------------
     *  IPC Response : 예전 Get FileTree 예는 아래와 같다.
     * (3) [{…}, {…}, {…}]
          0:
          filename: ".DS_Store"
          fullpath: "/Users/kimcy/Downloads/bk2/.DS_Store"
          size: 6148
          type: "file"
          __proto__: Object
          
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

      1. 목록구성이 완료되었다는 메세지 받음
      2. 선택된 폴더에 NPKI가 있는지 보고 있다면 zip파일을 만든다(이미만들어진 zip파일은 삭제)
      3. 선택된 폴더의 정보 즉 dir 전체 사이즈를 알려준다.

      현재 폴더트리 구성이 완료되면 업로드 시작
      this.subject.next(this.filesToSend[0]); //processFile 호출?? 을 사용해 볼까?
     ------------------------------------------------------------------------*/
     this.electronService.ipcRenderer.on('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('새로만든, 받음 GETFOLDERTREE, response = ',response);

    
      //fullpath 변수 사용? 안하게?
      //목록 구성이 끝난 폴더의 사이즈 요청
      //1. 블록체인 에러 목록 요청 하고 업로드
      log.info('this.member.private = ',this.member.private);
      if(this.member.private){
        //this.requestUploadList(event);
        this.sendIndex = 0;
        this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
          folderIndex: this.folderIndex,
          username: this.member.username
        });
      }else{
        //this.requestChainErrorList(event);
        this.sendIndex = 0;
        this.electronService.ipcRenderer.send('REQ-CHAINTREE', {
          folderIndex: this.folderIndex,
          username: this.member.username
        });
      }
      
      //폴더 사이즈 query 구현은 하지 않아서 뺀다.
      // this.electronService.ipcRenderer.send('REQ-DIRSIZE', {
      //   folderIndex: this.folderIndex,
      //   username: this.member.username
      // });

      this.electronService.ipcRenderer.removeListener('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any)=>{
        log.info('GETFOLDERTREE, 콜백한번만 호출되게...');
      });

     });

     /*----------------------------------------------------
       *  IPC Response : Get CHAINTREE
       
      ----------------------------------------------------*/
      this.electronService.ipcRenderer.on('CHAINTREE', (event: Electron.IpcMessageEvent, response: any) => {
        log.info('받음 CHAINTREE ');
        console.log('requestChainErrorList =>CHAINTREE');
        const fileTree = response.tree; 
  
        this.chainsToSend = [];
  
        for(let i =0; i<fileTree.length; i++){
          this.chainsToSend.push({
            fileid:fileTree[i]['id'],
            folderIndex: this.folderIndex,
            file: this.deviceResource.macaddress+'/'+fileTree[i]['filename'].replace(/\\/g, '/'),
            filepath: fileTree[i]['filename'].replace(/\\/g, '/'),
            filesize: fileTree[i]['filesize']
          });
        }
  
        log.info('chainsToSend = ',this.chainsToSend);
  
        if(this.chainsToSend.length > 0){
          //파일 업로드 
          log.info('블록체인 업로드 실패목록 전송, sendIndex = ', this.sendIndex);
          this.uploadManager(this.chainsToSend[this.sendIndex], "chain-error");
        } else{
          //2. 업로드 목록 요청 하고 업로드
          log.info('11..업로드 목록으로 이동 ');
          //this.requestUploadList(event); 
          this.sendIndex = 0;
          this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
            folderIndex: this.folderIndex,
            username: this.member.username
          });
        }
        this.electronService.ipcRenderer.removeListener('CHAINTREE', (event: Electron.IpcMessageEvent, response: any)=>{
          log.info('블록체인에러, 콜백한번만 호출되게...');
        });

      });
  
      /*----------------------------------------------------
       *  IPC Response : Get chain-error
       *  send는 chainuploadCb 에서 보내준다.
      ----------------------------------------------------*/
      this.electronService.ipcRenderer.on('chain-error', (event: Electron.IpcMessageEvent, response: any) => {
        //log.info('받음 chain-error = ',response.error);
  
        if(response.error == null ){

          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + ' :체인에러 파일 업로드 완료 (' + this.sendIndex+1 + '/' + this.chainsToSend.length + ')'
          });

          this.sendIndex++;

          // log.info('11..업로드 완료후 sendIndex = ',this.sendIndex);
          // log.info('11..this.chainsToSend.length = ',this.chainsToSend.length);

          if(this.chainsToSend.length > this.sendIndex){
            this.uploadManager(this.chainsToSend[this.sendIndex], "chain-error");
          }else{
            //log.info('22..업로드 목록으로 이동 ');
            //this.requestUploadList(event); 
            this.sendIndex = 0;
            this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
              folderIndex: this.folderIndex,
              username: this.member.username
            });
          }
  
        }else{
          log.error('에러 목록 업데이트중, 블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response 
                   , 'id = ', this.chainsToSend[this.sendIndex].fileid);
        }
      });
      
     /*----------------------------------------------------
       *  IPC Response : Get UPLOADTREE
       
      ----------------------------------------------------*/
     this.electronService.ipcRenderer.on('UPLOADTREE', (event: Electron.IpcMessageEvent, response: any) => {
     //this.electronService.ipcRenderer.once('UPLOADTREE', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('받음 UPLOADTREE ');
      const fileTree = response.tree; 

      this.addfilesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.addfilesToSend.push({
          fileid:fileTree[i]['id'],
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+'/'+fileTree[i]['filename'].replace(/\\/g, '/'),
          filepath:fileTree[i]['filename'].replace(/\\/g, '/'),
          filesize:fileTree[i]['filesize']
        });
      }
      
      //log.info('addfilesToSend = ',this.addfilesToSend);

      if(this.addfilesToSend.length > 0){
        //파일 업로드 
        log.info('처음, 업로드, sendIndex = ', this.sendIndex);
        log.info('this.addfilesToSend.length = ',this.addfilesToSend.length);
        this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
      } else{
        //2. 업데이트 목록 요청 하고 업로드
        log.info('목록없음으로, 업데이트 목록 요청');
        //this.requestUpdateList();
        this.sendIndex = 0;

        this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
          folderIndex: this.folderIndex,
          username: this.member.username
        });
      }

      this.electronService.ipcRenderer.removeListener('UPLOADTREE', (event: Electron.IpcMessageEvent, response: any)=>{
        log.info('콜백한번만 호출되게...');
      });
    });

    /*----------------------------------------------------
       *  IPC Response : Get add-file
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on("add-file", (event: Electron.IpcMessageEvent, response: any) => {
      //log.info('받음, 업로드,  add-file ');

      //log.info('this.member.private = ' , this.member.private)

      if(this.member.private){
        if(response.error === null ){

          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + ' : 파일 업로드 완료 (' + this.sendIndex+1 + '/' + this.changefilesToSend.length + ')'
          });

          this.sendIndex++;

          if(this.addfilesToSend.length > this.sendIndex){
            this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
          }else{
            log.info('개인계정, 업로드완료, 업데이트 목록 요청');
            //this.requestUpdateList();
            this.sendIndex = 0;

            this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
              folderIndex: this.folderIndex,
              username: this.member.username
            });
          }
  
        }
      }else{
        if(response.error === null ){ //파일업로드 완료
          log.info('파일업로드완료 , 블록체인으로 이동')
          //main
          this.uploadManager(this.addfilesToSend[this.sendIndex], "chain-create");
        }
      }
    });

          
    /*----------------------------------------------------
       *  IPC Response : Get chain-create
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on("chain-create", (event: Electron.IpcMessageEvent, response: any) => {
      //log.info('create proof = ',response);

      if(response.error == null){

        this.notification.next({
          cmd: 'LOG',
          message: '[' + (this.folderIndex + 1) + '] ' + ' : 파일 업로드 완료 (' + (this.sendIndex+1) + '/' + this.addfilesToSend.length + ')'
        });

        this.sendIndex++;
        //log.info('33..this.addfilesToSend.length = ',this.addfilesToSend.length);
        if(this.addfilesToSend.length > this.sendIndex){
         // log.info('블록체인업로드완료 , 파일업로드로 이동')
          this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
        }else{
          log.info('파일업로드완료 , 업데이트으로 이동')
          //this.requestUpdateList();
          this.sendIndex = 0;

          this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
            folderIndex: this.folderIndex,
            username: this.member.username
          });
        }

      }else{
        log.error('블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response
                 , 'id = ', this.addfilesToSend[this.sendIndex].fileid);
      }
    });


  /*----------------------------------------------------
    *  IPC Response : Get UPDATETREE
    
  ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('UPDATETREE', (event: Electron.IpcMessageEvent, response: any) => {
    //this.electronService.ipcRenderer.once('UPDATETREE', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('받음 UPDATETREE ');
      const fileTree = response.tree; 

      this.changefilesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.changefilesToSend.push({
          fileid:fileTree[i]['id'],
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+'/'+fileTree[i]['filename'].replace(/\\/g, '/'),
          filepath:fileTree[i]['filename'].replace(/\\/g, '/'),
          filesize:fileTree[i]['filesize']
        });
      }
      
      log.info('changefilesToSend = ',this.changefilesToSend);

      if(this.changefilesToSend.length > 0){
        //파일 업로드 
        log.info('업데이트 시작, sendIndex = ', this.sendIndex);
        this.uploadManager(this.changefilesToSend[this.sendIndex], "change-file");
      } else{
        //2. 업데이트 목록 요청 하고 업로드
        log.info('업로드/업데이트 항목없음, 한폴더에 대한 모든 업로드/업데이트 완료');
        this.gotoNext();
      }

      this.electronService.ipcRenderer.removeListener('UPDATETREE', (event: Electron.IpcMessageEvent, response: any)=>{
        log.info('업데이트 목록 콜백한번만 호출되게...');
      });

    });

    /*----------------------------------------------------
       *  IPC Response : Get change-file
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on("change-file", (event: Electron.IpcMessageEvent, response: any) => {
     // console.log('받음 업데이트, change-file ');

      if(this.member.private){
        if(response.error === null ){

          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + ' : 변경 파일 업로드 완료 (' + this.sendIndex+1 + '/' + this.changefilesToSend.length + ')'
          });

          this.sendIndex++;
         // log.info('44..업데이트 완료후 sendIndex = ',this.sendIndex);
        //  log.info('44..this.changefilesToSend.length = ',this.changefilesToSend.length);
          if(this.changefilesToSend.length > this.sendIndex){
            this.uploadManager(this.changefilesToSend[this.sendIndex], "change-file");
          }else{
            log.info('개인계정,  한폴더에 대한 모든 업로드/업데이트 완료');
            this.gotoNext();
          }
  
        }
      }else{
        if(response.error === null ){ //파일업로드 완료
          log.info('11..파일업데이트완료 , 블록체인으로 이동')
          this.uploadManager(this.changefilesToSend[this.sendIndex], "chain-update");
        }
      }
    });

     /*----------------------------------------------------
       *  IPC Response : Get chain-update
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on("chain-update", (event: Electron.IpcMessageEvent, response: any) => {
      log.info('받음 업데이트 chain-update ');

      if(response.error == null){

        this.notification.next({
          cmd: 'LOG',
          message: '[' + (this.folderIndex + 1) + '] ' + ' : 변경 파일 업로드 완료 (' + this.sendIndex+1 + '/' + this.changefilesToSend.length + ')'
        });

        this.sendIndex++;
        //console.log('11..업로드 완료후 sendIndex = ',this.sendIndex);
        if(this.changefilesToSend.length > this.sendIndex){
         // log.info('블록체인업데이트 완료 , 파일업데이트 이동')
        //  log.info('this.changefilesToSend.length = ', this.changefilesToSend.length);
          this.uploadManager(this.changefilesToSend[this.sendIndex], "change-file");
        }else{
          log.info('블록체인포함, 한폴더에 대한 모든 업로드/업데이트 완료');
          this.gotoNext();
        }

      }else{
        log.error('블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response
                 , 'id = ', this.changefilesToSend[this.sendIndex].fileid);
      }
    }); 


  /*----------------------------------------------------
    *  IPC Response : Get chain-update
    폴더사이즈 구현은 하지 않는다.
    
  ----------------------------------------------------*/
//   this.electronService.ipcRenderer.on('DIRSIZE', (event: Electron.IpcMessageEvent, response: any) => {
//     log.info('받음 폴더사이즈 = ', response);
    
//     this.notification.next({
//        cmd: 'FOLDER.INFO',
//        folderData: {
//           index: response.folderIndex,
//           size:response.dirsize
//         }
//     });
    
//     this.electronService.ipcRenderer.removeListener('DIRSIZE', (event: Electron.IpcMessageEvent, response: any)=>{
//       log.info('폴더사이즈 콜백한번만 호출되게...');
//     });
//   });


  }

   /*----------------------------------------------------
    *  IPC Response : Get DIR size
       폴더 사이즈 얻기
       
   ----------------------------------------------------*/
  //  getFolderSize(){
  //    log.info('폴더사이즈 얻기')
  //    var electronService = new ElectronService();
  //    electronService.ipcRenderer.on('UPDATETREE', (event: Electron.IpcMessageEvent, response: any) => {
  //    });
  //  }

   /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Constructor
   올바른 폴더를 올리기 위해서...
   일단 사용안함.
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
   fillFollders() {
    //console.log('fillFollders ');
   // this.folders = new Array(4);


    // for (let i = 0; i < 4; i++) {
    //   this.folders[i] = {
    //     path: this.storageService.get(this.getFolderKey(i))
    //   };
    // }

    //console.log('this.folders = ',this.folders);
  }

  getFolderPath(folderIndex) {
    return this.storageService.get(this.getFolderKey(folderIndex));
  }


   requestChainErrorList(event){
    console.log('requestChainErrorList');
    log.info('블록체인 업로드 실패 목록 요청');
    //log.info('선택된 폴더 = ', this.folders[this.folderIndex]);

    this.sendIndex = 0;
    // this.electronService.ipcRenderer.send('REQ-CHAINTREE', {
    //   folderIndex: this.folderIndex,
    //   username: this.member.username
    // });
    // event.sender.send('REQ-CHAINTREE', {
    //     folderIndex: this.folderIndex,
    //     username: this.member.username
    //   });


  }

   requestUploadList(event){
    console.log('requestUploadList');
    log.info('업로드 목록 요청 username = ',this.member.username);
    //log.info('선택된 폴더 = ', this.folders[this.folderIndex]);
    this.sendIndex = 0;
    // this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
    //   folderIndex: this.folderIndex,
    //   username: this.member.username
    // });

  }

   requestUpdateList(){
    log.info('업데이트 요청');
    //log.info('선택된 폴더 = ', this.folders[this.folderIndex]);
    // this.sendIndex = 0;

    // this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
    //   folderIndex: this.folderIndex,
    //   username: this.member.username
    // });
 
  }

  //스토리지에 저장된 폴더의 키를 반환한다.
  private getFolderKey(folderIndex) {

    this.member = this.memberAPI.isLoggedin();

   // console.log('getFolderKey => 맴버 ', this.member);

    return 'folder:' + this.member.username + ':' + folderIndex;
  }

  //kimcy
  // getContainerList(storage, callback){
   
  //    console.log('getContainerList');
  //    var list = "";
  //    this.member = storage.get('member');
  //    console.log('44..맴버 = ',this.member);
  //   if(this.member == undefined){
  //     console.log('이경우는 어딜까??')
  //     return callback(false);
  //   }
  //   const token = this.member.token;
  //   var contaniername = this.member.username.replace(/"/g, '').replace(/"/g, '');
  //   var getObjListPromise = getObjList(contaniername, token,  "", list)
  //   //console.log('getObjListPromise = ', typeof getObjListPromise);

  //   getObjListPromise.then(function(result){

  //     console.log('결과 = ', result);
  //     storage.set('list',result);
  //     return callback(true);
  //   },function(error){
  //     console.log('목록가져오기 실패 = ',error);
  //     return callback(false);
  //   });
  //   //var initializePromise = this.initialize(contaniername, this.member.token);

  //   // initializePromise.then(function(result) {
  //   //    if(result === 'again'){
  //   //       var againMember = storage.get('member');
  //   //       var againContanier = againMember.username.replace(/"/g, '').replace(/"/g, '');
  //   //       var againToken = againMember.token;
  //   //       var options = {
  //   //         uri: M5MemberService.s3Storage+'/'+againContanier+'?format=json',
  //   //         headers: {
  //   //           'X-Auth-Token': againToken
  //   //         }
  //   //       };
  //   //       request.get(options, function(err, resp, body) {
  
  //   //           if(resp.statusCode == 200){
  //   //             console.log('2번째 목록얻어오기 성공');
  //   //             console.log(body);
  //   //             //resolve([resp.headers,body]);  //배열로 멀티값전달
  //   //             //storage.set('list',body);
  //   //           }else if(resp.statusCode == 204){
  //   //           console.log('처음 목록얻어오기 성공');
  //   //           storage.set('list',"No Content");
  //   //           }else{
  //   //               console.log('2번째 목록얻어오기 실패 = ',err);
  //   //           }
  //   //       });

  //   //    }else if(result === "No Content"){
  //   //     storage.set('list',result);
  //   //    // console.log("11..결과 body :",storage.get('list'));
  //   //     return callback(true);
  //   //    } else{
  //   //       if(result[0] <= PAGE_COUNT){
  //   //         console.log('result[1] = ',result[1]);
  //   //         storage.set('list',result[1]);
  //   //         return callback(true);;
  //   //       }else{

  //   //       }
  //   //    }

  //   // }, function(err) {
  //   //     console.log(err);
  //   //     return callback(false);

  //   // })

  // }


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

  private gotoNext() {
    log.info('gotoNext , folderIndex = ', this.folderIndex);
    this.notification.next({
      cmd: 'FOLDER.SENT',
      folderIndex: this.folderIndex +1
    });
    this.uploading = false;
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
  *  uploadManager

  -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private uploadManager(item, type){
    let post, chainuploading, backupZip;
    this.member = this.memberAPI.isLoggedin();
    var size =  (item.filesize / 1024 ) ;
    
    
    if(item.filepath.toLowerCase().indexOf('data_backup') >= 0){
       //하위폴더, zip, 다른 파일이 존재함.
        console.log('data_backup basename = ',path.basename(item.filepath));
        console.log('data_backup zip = ',path.extname(item.filepath));

       if(path.extname(item.filepath).toLowerCase() == ".zip"){
        backupZip = path.basename(item.filepath);
       }else{
         var filename = this.storageService.get('data_backup',StorageTranscoders.STRING)
         console.log('filename = ',filename);
         if(filename != undefined){
          console.log('업로드된 zip 있음 ');
          var fileLength = filename.length;
          var lastDot = filename.lastIndexOf('.')
          var fileExtension = filename.substring(lastDot+1, fileLength).toLowerCase(); 
          console.log('fileExtension = ',fileExtension);
          if(fileExtension == "zip"){
           backupZip = 'not-store';
          } /*else{
           backupZip = 'none';
          }*/
         }else{
          console.log('업로드된 zip 없음 ');
          backupZip = 'none';
         }
         
       }
      //  else if(this.storageService.get('data_backup',StorageTranscoders.STRING) ){
      //   backupZip = 'undefined';
      //  }else{
      //   backupZip = 'none';
      //  }
      //  let tmp = path.basename(item.filepath);
      //  backupZip = tmp.substring(0,tmp.lastIndexOf('.'));
      //  log.info("backupZip = ",backupZip);
      //backupZip = path.basename(item.filepath);
    }else{  //data_backup 폴더가 아닌경우..
      console.log('DATA_BACKUP폴더아님 ');
      backupZip = 'not-store';
    }

    post = {
      token: this.member.token,
      container: this.member.username,
      filename: item.file,
      filepath: item.filepath,
      fileid: item.fileid,
      folderIndex: item.folderIndex,
      uploadtype: type,
      data_backup: backupZip
    };

    if(type == 'chain-error' || type == 'chain-create' || type == 'chain-update'){
      this.electronService.ipcRenderer.send('SEND-CHAINFILE', post);
      chainuploading = true;
      log.info('체인파일은 = ',post);
    }else{
      this.electronService.ipcRenderer.send('SEND-FILE', post); //비동기
      chainuploading = false;
      log.info('업로드파일은 = ',post);
    }
    if(!chainuploading){
      this.notification.next({
        cmd: 'SENDING.STARTED',
        message: '[' + (item.folderIndex + 1) + '] ' + item.filepath + ' 업로딩...' + size.toFixed(2) +'KB'
        //message: '[' + (item.folderIndex + 1) + '] ' + path.basename(item.filepath) + ' 업로딩...' 
      });
    }


  }
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  *  send a file
   1. 넘겨진 item으로 부터 보낼 파일을 구성
   2. kt서버로부터 얻은 파일리스트를 이용하여 보낼목록을 구성
   3. data_backup파일에 있는 목록들중 최신것만 올릴 수 있게 구성
   4. 업로드할 파일은 업로드 
   5. 업로드된 파일은 이미 업데이트 되었다고 알려준다.
  -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  // private processFile(item) {
  //   console.log('업로드처리 시작 processFile');
  //   log.info('processFile, 업로드 프로세스 시작 사이즈 = ', item.length);
  //   log.info('processFile, item : ',item , 'this.folders[item.folderIndex].path : ',this.folders[item.folderIndex].path);
  //   if (item == null || this.folders[item.folderIndex].path === undefined) {  //this.folders[item.folderIndex].path: 설정한 업로드패스
  //     return;
  //   }
  //   //this.logger.debug('===', item);
  //   console.log('===', item);
  //   const file = item.file;
  //   let post;
  //   this.member = this.memberAPI.isLoggedin();
  //  //console.log('55..맴버 = ',this.member);
  //   console.log('업로드 file: ',file);
  //   /*---------------------------------------------------------------
  //       폴더도 Post를 하나 추가해놓아야함
  //    ----------------------------------------------------------------*/

  //   const paths = path.dirname(file.fullpath).split(path.sep);  //fullpath를 /로 분리하여 저장
  //   //console.log('업로드 paths: ',paths);  
  //   const parentPath = (paths.slice(0, paths.length).join(path.sep)).replace(/\\/g, '/');
  //  //console.log('업로드 parentPath: ',parentPath);
  //   const folderName = this.folders[item.folderIndex].path.replace(/\\/g, '/');
  //   //console.log('업로드 folderName: ',folderName);
  //   const code = file.fullpath.replace(/\\/g, '/');  //비교대상
  //   //console.log('업로드 code: ',code);
  //   const deviceId = this.deviceResource.macaddress;

  //   let userToken = this.member.token;
  //   let username = this.member.username;

  //   if (item.file.type === 'folder') {
  //     let uertoken = 
  //     post = {
  //       index: item.index,
  //       file: file,
  //       formData: {
  //         type: 'item',
  //         categories: [parentPath],                     // 파일이 포함된 path
  //         subtype: file.type,
  //         title: file.filename,
  //         status: folderName,                           // 사용자가 선택한 폴더
  //         code: this.deviceResource.macaddress + '/' + code,                                   // 파일의 fullpath
  //         subtitle: code,
  //         checkCode: 'true',
  //         checkCodeAction: 'update',
  //         userData: {
  //           parentPath: parentPath,
  //           totalSize: item.size,
  //           // created: file.created,
  //           // updated: file.updated,
  //           // accessed: file.accessed,
  //         }
  //       },
  //       accessToken: userToken,
  //       username:username,
  //     };
  //   } else {
  //    // console.log('file  타입: ',this.storageService.get('userToken'));
  //     post = {
  //       index: item.index,
  //       file: file,
  //       formData: {
  //         type: 'item',
  //         categories: [parentPath],                     // 파일이 포함된 path
  //         subtype: file.type,
  //         title: file.filename,
  //         status: folderName,                           // 사용자가 선택한 폴더
  //         code: this.deviceResource.macaddress + '/' + code,                                   
  //         subtitle: code,
  //         checkCode: 'true',
  //         checkCodeAction: 'create',  
  //         chain:'create',
  //         userData: {
  //           parentPath: parentPath,
  //           totalSize: file.size,
  //           // created: file.created,
  //           // updated: file.updated,
  //           // accessed: file.accessed,
  //         }
  //       },
  //       accessToken: userToken,
  //       username:username,
  //     };
  //   }

  //   /*---------------------------------------------------------------
  //         이미 존재하는지 체크, 
  //       ----------------------------------------------------------------*/
  //   //공용과 블록체인을 나워야...
  //   let existPost = null;
  //   var listObj = this.storageService.get('list');
  //   log.warn('listObj = ',listObj);
  //   //console.log('upload.filetree, 리스트목록 = ',listObj);
  //  // console.log('리스트목록 갯수 = ',listObj.length);
  //   if(listObj != '[]' && listObj != 'No Content' && file.type != 'folder' 
  //      && listObj != undefined){
  //     let jsonExitPost = JSON.parse(listObj);
  //     // console.log('json, 리스트목록  = ',jsonExitPost);
  //      console.log('리스트목록 갯수 = ',jsonExitPost.length);
  //      log.info('리스트목록 갯수 = ',jsonExitPost.length);
  //     // console.log('deviceId = ',deviceId);
  //    // console.log('item.name = ',item.name);


  //    console.log('deviceId = ',deviceId);

  //     let diffJsonPost = jsonExitPost.filter(function (item){
  //          console.log('item = ',item);
  //          return item.name.startsWith(deviceId);
           
  //     });
  //    // process.takeHeapSnapshot('/Users/kimcy/dev/SafeBackUp')

  //     //log.warn(process.getHeapStatistics());
      
  //     //log.warn('listObj = ', listObj);
  //     //log.warn('jsonExitPost = ', listObj);
  //     listObj = null;
  //     jsonExitPost = null;

  //     console.log('diffJsonPost = ',diffJsonPost);
  //     console.log('post.formData.code = ',post.formData.code);
  //     for(var ele in diffJsonPost){
  //       if(diffJsonPost[ele].name === post.formData.code){
  //         if(diffJsonPost[ele].bytes === file.size){
  //           existPost = 'already-exists';
  //           //console.log('업데이트된 파일');
  //           diffJsonPost.splice(ele,1);
  //           var list = JSON.stringify(diffJsonPost);
  //           //console.log('list = ', list);
  //           this.storageService.set('list',list);
  //           break;
  //         }else if(diffJsonPost[ele].bytes != file.size){
  //           //파일 이름은 같은데 파일사이즈가 다르면 신규파일이지만 블록체인에는 update로 기록해야 한다.
  //           existPost = 'need-update';
  //         }
  //       }
  //     }

  //     diffJsonPost = null;

  //     //2. 목록 안지우고 비교
  //     // for(var ele in jsonExitPost){
  //     //   //동일한 이름값이면 filesize체크해서 변경유무 파악
  //     //   // console.log('목록있음,,,jsonExitPost[ele].name = ',ele, jsonExitPost[ele].name);
  //     //    console.log('한글 = ', code);
  //     //   if(jsonExitPost[ele].name === post.formData.code){
  //     //     if(jsonExitPost[ele].bytes === file.size){
  //     //       existPost = 'update-already';
  //     //       console.log('업데이트된 파일');
  //     //       jsonExitPost.splice(ele,1);
  //     //       var list = JSON.stringify(jsonExitPost);
  //     //       console.log('list = ', list);
  //     //       this.storageService.set('list',list);
  //     //       break;
  //     //     }
  //     //   }
  //     // }
  //   }else if(listObj === '[]' || listObj === 'No Content'){
  //     console.log('맨 처음 올리는것임');
  //     log.info('processFile, 맨 처음 업로드');
  //   }else{
  //     console.log('에러 => 처음부터 다시 올림?? 맞나??');
  //     log.error('processFile, 에러발생');
  //   }

    


  //   /*---------------------------------------------------------------
  //       업로드 제외 파일
  //     ----------------------------------------------------------------*/
  //   //data_backup/zip파일을 날짜별로 소팅해서 오래된것에는 doNotSend flag를 셋팅했음
  //   if (this.filesToSend[item.index].doNotSend === true) {
  //     log.info('processFile, data_backup의 zip파일중 예전데이터 처리');
  //     console.log('업로드제외파일');
  //     const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename;
  //     this.notification.next({
  //       cmd: 'LOG',
  //       message: message + ' : 업로드 제외 파일입니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
  //     });
      

  //     //kimcy: 서버에 data_backup/zip파일(이전) 삭제에 관한 것 더 논의하여 작업
  //     // if (existPost != null) {
  //     //   this.notification.next({
  //     //     cmd: 'LOG',
  //     //     message: message + ' : 클라우드에서 삭제됩니다. (' + (item.index + 1) + '/' + this.filesToSend.length + ')'
  //     //   });
  //     //   this.postAPI.delete(existPost.id, {}).subscribe(
  //     //     response => {
  //     //       this.gotoNextFile(item.index);
  //     //     },
  //     //     error => {
  //     //       this.gotoNextFile(item.index);
  //     //     }
  //     //   );
  //     // }
  //     //else 
  //     {
  //       //console.log('upload.filetree, item.index = ',item.index);
  //       log.info('processFile, data_backup의 zip파일 처리, 다음파일 : ',item.index);
  //       this.gotoNextFile(item.index);
  //     }

  //   }
  //   /*---------------------------------------------------------------
  //       업로드해야할 파일 판단, 업로드 시작
  //     ----------------------------------------------------------------*/
  //   else {

  //     console.log('업로드 해야 할 파일 판단, 업로드 시작',  code);
  //     log.warn('processFile, 업로드해야할 파일 처리 code : ',code);
  //     if (existPost == null && file.type != 'folder') {
  //       const pipe = new BytesPipe();
  //       const size = pipe.transform(this.filesToSend[item.index].file.size);
  //       this.notification.next({
  //         cmd: 'SENDING.STARTED',
  //         message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
  //       });
  //       // console.log('보냄, upload.filetree, SENDFILE ');
  //       //  console.log('보냄, code =  ', post.formData.code);
  //       //  console.log('보냄, code11 =  ', post.formData.code.replace(/\\/g, '/'));
  //       log.warn('processFile, 신규파일 업로드 : ',post.formData.code);
  //        post.formData.chain = 'chain-create';
  //       this.electronService.ipcRenderer.send('SENDFILE', post);
  //     } else if(existPost === 'need-update'){
  //       const pipe = new BytesPipe();
  //       const size = pipe.transform(this.filesToSend[item.index].file.size);
  //       this.notification.next({
  //         cmd: 'SENDING.STARTED',
  //         message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
  //       });
  //       log.warn('processFile, 변경파일 업로드 : ',post.formData.code);
  //       post.formData.chain = 'chain-update';  //블록체인
  //       this.electronService.ipcRenderer.send('SENDFILE', post);
  //     } else if(existPost == null && file.type === 'folder'){
  //       console.log('폴더는 업로드 하지 않음');
  //       log.warn('processFile, 폴더는 업로드 제외 ',post.formData.code);
  //       this.gotoNextFile(item.index);
  //     } else {
  //       //이미 있는 파일인데 무슨이유에서인지 블록체인에는 없는 파일(둘다올림?)
  //       console.log('chain , post.formData.code =',post.formData.code);
  //       // if(existPost === 'already-exists'){
  //       //   var jsonChainPost = this.storageService.get('chain');
  //       //   console.log('chainObj = ',jsonChainPost);
  //       //   for(var ele in jsonChainPost){
  //       //     if(jsonChainPost[ele].name === post.formData.code){
  //       //       existPost = 'already-exists'
  //       //       console.log('체인에 있음 ');
  //       //       break;
  //       //     }else{
  //       //       console.log('체인에 없음 ');
  //       //       existPost = null;
  //       //     }
  //       //   }
  //       // }

  //      // jsonChainPost = null;

  //       // if (existPost == null && file.type != 'folder'){
  //       //   console.log('체인에 없어서 다시 보냄');
  //       //   const pipe = new BytesPipe();
  //       //   const size = pipe.transform(this.filesToSend[item.index].file.size);
  //       //   this.notification.next({
  //       //     cmd: 'SENDING.STARTED',
  //       //     message: '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' 업로딩...' + size 
  //       //   });
  //       //   console.log('chain, 보냄, upload.filetree, SENDFILE ');
  //       //    console.log('chain, 보냄, code =  ', post.formData.code);
  //       //    console.log('chain, 보냄, code11 =  ', post.formData.code.replace(/\\/g, '/'));
  //       //    //post.formData.chain = 'chain-create';
  //       //    post.formData.chain = 'chain-create'; //이경우는 update록..
  //       //   this.electronService.ipcRenderer.send('SENDFILE', post);
  //       // }else
        
  //       {
  //         //블록체인에도 있고 서버에도 있는 경우
  //         //this.logger.debug('이미 업로드된 파일', code);
  //         log.warn('이미 업로드된 파일', code);
  //         const message = '[' + (this.folderIndex + 1) + '] ' + this.filesToSend[item.index].file.filename + ' (' + (item.index + 1) + '/' + this.filesToSend.length + ')';
  //         this.notification.next({
  //           cmd: 'LOG',
  //           message: message + ' : 이미 업로드된 파일입니다. ' // + response.posts[0].id
  //         });
  //         log.warn('다음 파일', item.index);
  //         this.gotoNextFile(item.index);
  //       }
  //     }


  //     console.log('11..filesToSend.length = ',this.filesToSend.length,'item.index = ',item.index);
  //     //kimcy: 왜 다음파일을 보낼려고 하지?
  //     // if (this.filesToSend.length - 1 > item.index) {
  //     //   console.log('this.subject.next');
  //     //   this.subject.next(this.filesToSend[item.index + 1]);
  //     // } else {
  //     //   this.gotoNextFile(item.index);
  //     // }

  //   }

  // }

  getFolderTree(folderIndex, fullpath, member){
    this.uploading = true;
    this.folderIndex = folderIndex;
    //this.folders[folderIndex].path = fullpath;
    console.log('받은 member = ',member);
    this.member = member;
    console.log('this.member = ',this.member);

    console.log('getFolderTree, fullpath = ',fullpath);

    if(fullpath == undefined){
      this.uploading = false;

      if (this.electronService.isElectronApp){
        this.notification.next({cmd: 'LOG', message: '폴더' + (folderIndex + 1) + '는 지정 되지 않았습니다.'});
        this.notification.next({
          cmd: 'FOLDER.SENT',
          folderIndex:  folderIndex +1
        });
      }
    } else{

      if (this.electronService.isElectronApp) { //앱이 실행중이라면..
        console.log('11..upload ->앱이실행중이라 업로드');
        this.notification.next({cmd: 'LOG', message: '['+ (folderIndex + 1)+']'+fullpath + ' 업로드를 시작합니다.'});
        log.info('보냄, GETFOLDERTREE, upload-filetree');
        this.electronService.ipcRenderer.send('GETFOLDERTREE', {
          folderIndex: folderIndex,
          username: member.username,
          path: fullpath
        });
      }
    }

  }
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  main entry
   * this.folders 배열에 풀패스설정
   * 읽어온 폴더패스가 비어 있으면 메세지: ...는 지정 되지 않았습니다.
   * 토큰을 얻고, 토큰을 얻으면 서버에서 목록조회
   * 업로딩에 필요한 변수 초기화
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  // upload(folderIndex, fullpath) {

  // }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Process a file
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  notified(): Observable<any> {
    return this.notification.asObservable();
  }

}
