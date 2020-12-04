import {Inject, Injectable, OnDestroy, OnInit} from '@angular/core';
import {M5MemberService} from './m5/m5.member.service';
import {M5PostService} from './m5/m5.post.service';

import {ElectronService} from 'ngx-electron';
import {LOCAL_STORAGE, StorageService, StorageTranscoders} from 'ngx-webstorage-service';

import * as path from 'path';
import * as moment from 'moment';
import {Observable, Subject, Subscription} from 'rxjs';
import {M5Service} from './m5/m5.service';
//import {KonsoleService} from './konsole.service';
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
const reqestProm = require('request-promise-native')

@Injectable()
export class UploadFiletreeService {

  //private folders; 사용안함.
  private subscription;
  private subject;
  private filesToSend;

  //kimcy : 기존 변수 대신사용
  private chainsToSend = null;
  private addfilesToSend = null;
  private changefilesToSend = null;
  private sendIndex;

  private folderIndex;
  private deviceResource;
  private board;
  private member;
  private accessToken;

  private uploading = false;
  private notification = null;





  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private electronService: ElectronService,
  //  private konsoleService: KonsoleService,
    private logger: NGXLogger,
    @Inject(LOCAL_STORAGE) private storageService: StorageService) {
    //this.member = this.memberAPI.isLoggedin();
    this.member;
    console.log('dd..맴버 = ',this.member);


    this.notification = new Subject();
    //this.subject = new Subject();
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

    this.electronService.ipcRenderer.on('GETFOLDERTREE', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('새로만든, 받음 GETFOLDERTREE, response = ',response);

    
      //fullpath 변수 사용? 안하게?
      //목록 구성이 끝난 폴더의 사이즈 요청
      //1. 블록체인 에러 목록 요청 하고 업로드
      log.info('this.member.private = ',this.member.private);
      if(this.member.private){
        this.sendIndex = 0;
        this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
          folderIndex: this.folderIndex,
          username: this.member.username
        });
      }else{
        this.sendIndex = 0;
        this.electronService.ipcRenderer.send('REQ-CHAINTREE', { //블록체인 에러목록조회
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
  
        //log.info('fileTree = ',fileTree);

        this.chainsToSend = [];
  
        for(let i =0; i<fileTree.length; i++){
          this.chainsToSend.push({
            fileid:fileTree[i]['id'],
            folderIndex: this.folderIndex,
            file: this.deviceResource.macaddress+'/'+fileTree[i]['filename'].replace(/\\/g, '/'),
            filepath: fileTree[i]['filename'].replace(/\\/g, '/'),
            filesize: fileTree[i]['filesize'],
            tableName: fileTree[i]['tbName']
          });
        }
  
        log.info('chainsToSend = ',this.chainsToSend);
  
        if(this.chainsToSend.length > 0){
          //파일 업로드 
          log.info('블록체인 업로드 실패목록 전송, sendIndex = ', this.sendIndex);
          this.uploadManager(this.chainsToSend[this.sendIndex], "chain-error");
        } else{
          //2. 업로드 목록 요청 하고 업로드
          //log.info('11..업로드 목록으로 이동 ');
          this.chainsToSend = null;
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
        log.info('받음 chain-error = ',response.error);
  
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
            log.info('22..업로드 목록으로 이동 ');
            this.sendIndex = 0;
            this.electronService.ipcRenderer.send('REQ-UPLOADTREE', {
              folderIndex: this.folderIndex,
              username: this.member.username
            });
          }
  
        }else{
          log.error('에러 목록 업데이트중, 블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response 
                   , 'id = ', this.chainsToSend[this.sendIndex].fileid);
          this.storageService.set('upload','error');
        }
      });
      
     /*----------------------------------------------------
       *  IPC Response : Get UPLOADTREE
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('UPLOADTREE', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('받음 UPLOADTREE ');
      const fileTree = response.tree; 

      this.addfilesToSend = [];

      for(let i =0; i<fileTree.length; i++){
        this.addfilesToSend.push({
          fileid:fileTree[i]['id'],
          folderIndex: this.folderIndex,
          file: this.deviceResource.macaddress+'/'+fileTree[i]['filename'].replace(/\\/g, '/'),
          filepath:fileTree[i]['filename'].replace(/\\/g, '/'),
          filesize:fileTree[i]['filesize'],
          tableName: fileTree[i]['tbName']
        });
      }


      if(this.addfilesToSend.length > 0){
        //파일 업로드 
        log.info('처음, 업로드, sendIndex = ', this.sendIndex);
        log.info('this.addfilesToSend.length = ',this.addfilesToSend.length);
        this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
      } else{
        //2. 업데이트 목록 요청 하고 업로드
        log.info('목록없음으로, 업데이트 목록 요청');
        this.addfilesToSend = null;
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
      console.info('받음, 업로드,  add-file ');

      if(this.member.private){
        if(response.error === null ){
          console.log('파일업로드 완료 = ', (this.sendIndex + 1));

          
          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + ' : 파일 업로드 완료 (' + (this.sendIndex + 1) + '/' + this.addfilesToSend.length + ')'
          });

          this.sendIndex++;
          //console.log('add-file 다음파일 = ',this.sendIndex);
          if(this.addfilesToSend.length > this.sendIndex){
            this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
          }else{
            log.info('private계정 업로드완료, 업데이트 목록 요청');

            this.addfilesToSend = null;
            this.sendIndex = 0;

            this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
              folderIndex: this.folderIndex,
              username: this.member.username
            });
          }
  
        }else{
          log.error('private계정 업로드 에러 = ', response.error);
          if(response.error == '403' || response.error == 403 
             || response.error == '401' || response.error == 401){
            this.getNewToken();
          }else if(response.error == '500' || response.error == 500){
            this.sendIndex++;
            console.log('private계정 500에러 다음파일 = ',this.sendIndex);
            if(this.addfilesToSend.length > this.sendIndex){
              this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
            }else{
              log.info('private계정 업로드완료, 업데이트 목록 요청');
  
              this.addfilesToSend = null;
              this.sendIndex = 0;
  
              this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
                folderIndex: this.folderIndex,
                username: this.member.username
              });
            }
          }
        }
      }else{
        if(response.error === null ){ //파일업로드 완료
          log.info('public계정 업로드완료 , 블록체인으로 이동');
          this.uploadManager(this.addfilesToSend[this.sendIndex], "chain-create");
        }else if(response.error === "1010" ){
          this.notification.next({
            cmd: 'LOG',
            message: '[' + (this.folderIndex + 1) + '] ' + ' : 해당 파일이 존재하지 않습니다 !!' 
          });

          this.sendIndex++;
          if(this.addfilesToSend.length > this.sendIndex){
            this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
          }else{
            log.info('삭제된 파일이 폴더의 마지막!!');
            this.gotoNext();
          }
        }
        
        else{
          log.error('public계정 업로드 에러 = ', response.error);
          if(response.error == '403' || response.error == 403 
             || response.error == '401' || response.error == 401){
            this.getNewToken();
          }else if(response.error == '500' || response.error == 500){
            this.sendIndex++;
            console.log('public계정 500에러 다음파일 = ',this.sendIndex);
            if(this.addfilesToSend.length > this.sendIndex){
              this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
            }else{
              this.gotoNext();
            }
          } 
        }
      }
    });

          
    /*----------------------------------------------------
       *  IPC Response : Get chain-create
       
      ----------------------------------------------------*/
    this.electronService.ipcRenderer.on("chain-create", (event: Electron.IpcMessageEvent, response: any) => {
      console.log('chain-create = ',response);

      if(response.error == null){

        //console.log('sendIndex = ', typeof this.sendIndex);
        this.notification.next({
          cmd: 'LOG',
          message: '[' + (this.folderIndex + 1) + '] ' + ' : 파일 업로드 완료 (' + (this.sendIndex + 1) + '/' + this.addfilesToSend.length + ')'
        });

        this.sendIndex++;
        //log.info('33..this.addfilesToSend.length = ',this.addfilesToSend.length);
        if(this.addfilesToSend.length > this.sendIndex){
         // log.info('블록체인업로드완료 , 파일업로드로 이동')
          this.uploadManager(this.addfilesToSend[this.sendIndex], "add-file");
        }else{
          log.info('파일업로드완료 , 업데이트으로 이동')

          this.addfilesToSend = null;
          this.sendIndex = 0;

          this.electronService.ipcRenderer.send('REQ-UPDATETREE', {
            folderIndex: this.folderIndex,
            username: this.member.username
          });
        }

      }else{
        log.error('블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response
                 , 'id = ', this.addfilesToSend[this.sendIndex].fileid);
        this.storageService.set('upload','error');
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
          filesize:fileTree[i]['filesize'],
          tableName: fileTree[i]['tbName']
        });
      }
      
      log.info('changefilesToSend = ',this.changefilesToSend);

      if(this.changefilesToSend.length > 0){
        //파일 업로드 
        log.info('업데이트 시작, sendIndex = ', this.sendIndex);
        this.uploadManager(this.changefilesToSend[this.sendIndex], "change-file");
      } else{
        //2. 업데이트 목록 요청 하고 업로드
        log.info('업데이트 항목없음, 한폴더에 대한 모든 업데이트 완료');
        this.changefilesToSend = null;
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
            log.info('개인계정,  한폴더에 대한 모든 업데이트 완료');
            this.changefilesToSend = null;
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
          log.info('블록체인포함, 한폴더에 대한 모든 업데이트 완료');
          this.changefilesToSend = null;
          this.gotoNext();
        }

      }else{
        log.error('블록체인에러, 백업시작버튼을 눌러 다시 시작해야 한다. = ',response
                 , 'id = ', this.changefilesToSend[this.sendIndex].fileid);
        this.storageService.set('upload','error');
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
  //  fillFollders() {
  //   //console.log('fillFollders ');
  //  // this.folders = new Array(4);


  //   // for (let i = 0; i < 4; i++) {
  //   //   this.folders[i] = {
  //   //     path: this.storageService.get(this.getFolderKey(i))
  //   //   };
  //   // }

  //   //console.log('this.folders = ',this.folders);
  // }

  getFolderPath(folderIndex) {
    return this.storageService.get(this.getFolderKey(folderIndex));
  }


   requestChainErrorList(event){
    console.log('requestChainErrorList');
    log.info('블록체인 업로드 실패 목록 요청');
    this.sendIndex = 0;
  }

   requestUploadList(event){
    //console.log('requestUploadList');
    log.info('업로드 목록 요청 username = ',this.member.username);
    this.sendIndex = 0;
  }

   requestUpdateList(){
    log.info('업데이트 요청');
 
  }

  //스토리지에 저장된 폴더의 키를 반환한다.
private getFolderKey(folderIndex) {

  this.member = this.memberAPI.isLoggedin();

  // console.log('getFolderKey => 맴버 ', this.member);

  return 'folder:' + this.member.username + ':' + folderIndex;
}

public setUploadingStatus(set){
  this.uploading = set;
}

public setUploadMember(set){
  this.member = set;
}



  private gotoNext() {
    log.info('gotoNext , folderIndex = ', this.folderIndex);
    this.notification.next({
      cmd: 'FOLDER.SENT',
      folderIndex: this.folderIndex +1
    });
    this.uploading = false;
  }


  private getNewToken(){
  
    this.member = this.memberAPI.isLoggedin();

    var options = {  
      method: 'POST',
      uri: M5MemberService.login, 
      headers:{
          'Content-Type': 'application/json'
      },
      body:{
        id:this.member.username,
        pwd:this.member.password,
        client: M5MemberService.safebackupVersion
      },
      json: true    
    };

    reqestProm(options).then((body) =>{

      this.member.token = body.token;
      this.storageService.set('member',this.member);
    }).catch(function (err) {
      // POST failed...
      log.error('토큰받기 실패 = ',err);
    });

  }
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
  *  uploadManager

  -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private uploadManager(item, type){
    let post = null;
    let chainuploading, backupZip;
    this.member = this.memberAPI.isLoggedin();
    var size =  (item.filesize / 1024 ) ;
    
    log.info('item = ', item);

    if(item.filepath.toLowerCase().indexOf('data_backup') >= 0){
       //하위폴더, zip, 다른 파일이 존재함.
        console.log('data_backup basename = ',path.basename(item.filepath));
        console.log('data_backup zip = ',path.extname(item.filepath));

       if(path.extname(item.filepath).toLowerCase() == ".zip"){
        //backupZip = path.basename(item.filepath); //파일명추출
        var filname = path.basename(item.filepath, path.extname(item.filepath));
        console.log('data_backup filname = ',typeof filname);
        var pattern = /[0-9]{4}[0-9]{2}[0-9]{2}/;
        //var pattern = /₩d{4}₩d{2}₩d{2}/;
        // if(pattern.test(filename)){
        //   backupZip = filname;
        // }else{
        //   backupZip = 'not-store';
        // }
        //backupZip = filname;
        if ((new RegExp(pattern)).test(filname)){
            backupZip = filname;
        }else{
          backupZip = 'not-store';
        }
       }else{ 
         var filename = this.storageService.get('data_backup',StorageTranscoders.STRING)
         log.info('filename = ',typeof filename);
         log.info('filename = ', filename);
         if(filename != "undefined" ){
          log.info('업로드된 zip 있음 ');
          // var fileLength = filename.length;
          // var lastDot = filename.lastIndexOf('.')
          // var fileExtension = filename.substring(lastDot+1, fileLength).toLowerCase(); 
          // log.info('fileExtension = ',fileExtension);
          // if(fileExtension == "zip"){
          //  backupZip = 'not-store';
          // }
          log.info('스팩오류');
          backupZip = 'not-store';
         }else{
          log.info('업로드된 zip 없음 ');
          backupZip = 'none';
         }
         
       }

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
      data_backup: backupZip,
      tablename: item.tableName 
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
      console.log('파일업로딩 ',size.toFixed(2));


      this.notification.next({
        cmd: 'SENDING.STARTED',
        message: '[' + (item.folderIndex + 1) + '] ' + item.filepath + ' 업로딩...' + size.toFixed(2) +'KB'

      });
    }
  }
  

  getFolderTree(folderIndex, fullpath, member){
    this.uploading = true;
    this.folderIndex = folderIndex;
    //this.folders[folderIndex].path = fullpath;
    //console.log('받은 member = ',member);
    this.member = member;
    //console.log('this.member = ',this.member);

    log.info('getFolderTree, fullpath = ',fullpath);

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
     // this.storageService.set('fscan','start');
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
