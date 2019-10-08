import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { M5MemberService } from '../../services/m5/m5.member.service';
import { LOCAL_STORAGE, StorageService, StorageTranscoders } from 'ngx-webstorage-service';
import { ElectronService } from 'ngx-electron';
import { M5PostService } from '../../services/m5/m5.post.service';
import { UploadFiletreeService } from '../../services/upload.filetree.service';
import { BsModalRef, BsModalService, ModalModule } from 'ngx-bootstrap';
import * as path from 'path';
import { KonsoleService } from '../../services/konsole.service';
import * as moment from 'moment';
import { ObjectUtils } from '../../utils/ObjectUtils';
import { NGXLogger } from 'ngx-logger';
import { environment } from '../../../environments/environment';
import { fstat } from 'fs';
const log = require('electron-log');
const fs = require('fs');

@Component({
  selector: 'app-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})


export class HomePageComponent implements OnInit, OnDestroy {
  
  private PRIVATE_FLENGTH = 1;
  private PUBLIC_FLENGTH =2;
  //private MAXFOLDERLENGTH = this.PRIVATE_FLENGTH + this.PUBLIC_FLENGTH;

  public version: string;
 // private board;
  public member;
  private deviceResource;
  private uploadSubscribe;


 // private accessToken;

  public rootFolderName;
  public rootFolderData;
  public parentFolder;

  private foldersSize; // = new Array(this.MAXFOLDERLENGTH);
  private storedFolders = {};
  public selectedFolderIndex = 0;
  public showingFolderName;
  public showingFileList = [];
  public showingFolderList = [];

  public uploading = false;
  private alertModal: BsModalRef;
  public memberPrivate = false;
  private maxFolder;
  private timergetTree;
  private timerStart;

  constructor(
    private memberAPI: M5MemberService,
    private postAPI: M5PostService,
    private electronService: ElectronService,
    private uploadFiletreeService: UploadFiletreeService,
    private konsoleService: KonsoleService,
    private logger: NGXLogger,
    @Inject(LOCAL_STORAGE) private storageService: StorageService,
    private modalService: BsModalService,
    private router: Router) {
  }


  private getFolderKey(folderIndex) {  //폴더+사용자이름+폴더index 붙여서 return
    console.log('home-page, getFolderKey => folderIndex ',folderIndex, this.member.username);

    this.member = this.memberAPI.isLoggedin();

    const key = 'folder:' + this.member.username + ':' + folderIndex;
    //this.logger.debug('FOLDERKEY', key, 'username = ' + this.member.username);
    console.log('FOLDERKEY', key, 'username = ' + this.member.username)
    return key;
  }


  onLogout() {
    //console.log('로그아웃버튼 눌림');
    log.info('로그아웃버튼 눌림');
    this.uploadFiletreeService.setUploadingStatus(false);
    this.uploadFiletreeService.setUploadMember(null);
    this.uploading = false;
    this.memberAPI.logout();
    this.router.navigateByUrl('/');
    this.timerClear();
    this.electronService.ipcRenderer.removeAllListeners('SELECTFOLDER');
  }

  // gotoRoot(){
  //   this.router.navigateByUrl('/');
  // }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  탭 버튼을 누를경우 저장된 폴더의 패스를 구해와서 보여주기 위한 것임
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onTab(tabIndex) {
    console.log('탭이 선택됨', tabIndex);
    this.selectedFolderIndex = tabIndex;
    const folderKey = this.getFolderKey(tabIndex);
    const folder = this.storageService.get(folderKey);

    console.log('folderKey = ', folderKey, 'folder = ', folder);

    //this.logger.debug('FOLDERNAME', folder, folderKey);
 

    if (folder != undefined) {
      this.rootFolderName = folder;
      this.showingFolderName = folder;
      this.onRequestFolderData(this.selectedFolderIndex);
 
    } else {
      //설정한 폴더가 없다면??
      console.log('설정된 폴더가 없음');
      this.rootFolderName = '';
      this.showingFolderName = '';
      this.showingFolderList = [];
      this.showingFileList = [];

    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  home화면에서 폴더선택시 불려진다
   *  해당 이벤트 발생시  db를 갱신한다.
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onChangeFolder(folderIndex) {
    this.selectedFolderIndex = folderIndex;
    log.info('보냄,home-page, onChangeFolder, SELECTFOLDER ,  folderIndex = ',folderIndex );
    this.electronService.ipcRenderer.send('SELECTFOLDER', {
      folderIndex: folderIndex,
      username: this.member.username
    });
    this.storageService.set('login',false);

    // this.electronService.ipcRenderer.send('SELECTFOLDER', {
    // });
  }


  onRequestFolderData(folderIndex) {
    console.log('home-page, onRequestFolderData');
    if (this.deviceResource == null) {
      this.deviceResource = { macaddress: 'MAC' };
    }
    const folderKey = this.getFolderKey(folderIndex);
    const folder = this.storageService.get(folderKey);
  //  console.log('home-page, 22.. onRequestFolderData, folder = ',folder);
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Get FileTree from server
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onRequestFolderPosts(folderIndex, gotoPath, files) {
    console.log('homepage => onRequestFolderPosts', folderIndex, gotoPath, files);
    if (gotoPath === undefined) {
      return;
    }

    this.showingFolderName = gotoPath;
    this.showingFolderList = [];
    this.showingFileList = [];
    const paths = path.dirname(gotoPath).split(path.sep);
    this.parentFolder = paths.slice(0, paths.length).join('/');

    //this.logger.debug('SUBFOLDER', gotoPath, this.parentFolder);
    //kimcy: 이걸보여주면? 무엇이?
    //this.showingFolderList.push(this.parentFolder); //test code html line95에서 폴더 타이틀 찾는 부분에서 죽는다.

  }


  //kimcy: folderIndex 가 0이면 처음부터 시작
  onStartUploadFolder(folderIndex, after) {

    if (after == null) {
      after = 5;
    }
     const folderKey = this.getFolderKey(folderIndex);
     const folder = this.storageService.get(folderKey);  //폴더키로 조회하면 선택한 폴더를 스토리지로 부터 얻을 수 있다.
     log.info('home-page onStartUploadFolder = ', folder, 'folderKey = ', folderKey);

     

    this.timergetTree =  setTimeout(()=> {
        log.info('11..setTimeout, folderIndex = ', folderIndex, 'folder = ',folder, 'after = ',after); //after가 2이면 처음
        this.uploading = true;
        this.uploadFiletreeService.getFolderTree(folderIndex, folder, this.member);
     }, after * 1000);  //보통은 로그인후 3초후에 시작, 여기서 시간값을 바꾸면 시작값이 안 맞는다.(다음폴더는 5초후에), 백업시작버튼누르면 3초후에, 다음번은 1~4시간안에
     
  }

  checkEmergency(){

    for (let i = 0; i < this.maxFolder; i++) {
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey); //얻은키를 활용하여 선택된 폴더를 반환한다.
      if(this.storedFolders[i].toLowerCase().indexOf('data_backup') >= 0){
        // if(fs.existsSync(this.storedFolders[i]+'/*.zip') == false){
        //   return true
        // }else{
        //   return false
        // }data_backup data_backup
        // console.log('data_backup string= ', this.storageService.get('data_backup',StorageTranscoders.STRING));
        // console.log('data_backup json  = ', this.storageService.get('data_backup',StorageTranscoders.JSON));
        //lib..호환때문에..
        if(this.storageService.get('data_backup',StorageTranscoders.STRING) == undefined){
          return true;
        }else{
          return false;
        }
      }else{
        return false;
      }
    }

  }

  checkDay(day){
    //저장된파일이름
    //let filename;
    //let maxDate = moment().year(1990).month(0).date(1);
    
    // console.log('maxDate = ',maxDate);
    // console.log('minDiff = ',minDiff);
    let filename = this.storageService.get('data_backup',StorageTranscoders.STRING);
    console.log('filename = ',filename);
    if(filename != undefined){
      console.log('maxDate = ',filename);
      const fyyyy = Number(filename.substr(0, 4));
      const fmm = Number(filename.substr(4, 2));
      const fdd = Number(filename.substr(6, 2));
      const fdate = moment([fyyyy, fmm - 1, fdd]);
      let minDiff = moment().diff(fdate, 'days') + 1;
      console.log('minDiff = ',minDiff);
      if (minDiff >= day) {
        return true;
      }else{
        return false;
      }
    }else{
      log.error('checkDay, 저장된 zip파일명 없음')
    }
    

    // for (let i = 0; i < this.maxFolder; i++) {
    //   const folderKey = this.getFolderKey(i);
    //   this.storedFolders[i] = this.storageService.get(folderKey); //얻은키를 활용하여 선택된 폴더를 반환한다.
    //   if(this.storedFolders[i].toLowerCase().indexOf('data_backup') >= 0){
    //     return false;
    //   }else{
    //     return true;
    //   }
    // }

  }

  onStartBrowser(){
    require('electron').shell.openExternal("http://211.252.85.59/login");
  }

  fillFolders() {

    for (let i = 0; i < this.maxFolder; i++) {
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey); //얻은키를 활용하여 선택된 폴더를 반환한다.
      if (this.selectedFolderIndex === i) {
        this.showingFolderName = this.storedFolders[i];
      }
    }
  }

  ngOnDestroy() {
   // console.log('home-page, ngOnDestroy');
    this.uploadSubscribe.unsubscribe();
  }

  timerClear(){
    clearTimeout(this.timergetTree);
    clearTimeout(this.timerStart);
  }

  // unregCallback(){
  //   this.electronService.ipcRenderer.removeAllListeners('SELECTFOLDER');
  // }
  ngOnInit() {
    console.log('home-page, ngOnInit');
    this.version = environment.VERSION;
    this.electronService.ipcRenderer.send('PCRESOURCE', null);
    console.log('보냄 home-page, PCRESOURCE');
   // this.logger.debug('- HOMEPAGE ngOnInit: ', this.version);
    
    this.member = this.memberAPI.isLoggedin();
    this.memberPrivate = this.member.private;

    if(this.memberPrivate){
      this.maxFolder = this.PRIVATE_FLENGTH;
      this.foldersSize = new Array(this.PRIVATE_FLENGTH);
    }else{
      this.maxFolder = this.PUBLIC_FLENGTH;
      this.foldersSize = new Array(this.PUBLIC_FLENGTH);
    }
    
    //this.memberPrivate ? this.PRIVATE_FLENGTH  : this.PUBLIC_FLENGTH ;

    function getRandomInt(min, max) {
     // console.log('home-page, getRandomInt');
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /*---------------------------------------------------------------
           Subscribe to notification
     ----------------------------------------------------------------*/
  
    this.uploadSubscribe = this.uploadFiletreeService.notified().subscribe(message => {


      if (message.cmd === 'LOG') {
        /*---------------------------------------------------------------
              일반 로그
         ----------------------------------------------------------------*/
        this.konsoleService.sendMessage(message);
      } else if (message.cmd === 'SENDING.STARTED') {
        /*---------------------------------------------------------------
              파일전송 시작 로그
         ----------------------------------------------------------------*/
        console.log('home => 파일전송시작 로그');
        this.konsoleService.sendMessage(message);
      } else if (message.cmd === 'SENDING.PROGRESS') {
        /*---------------------------------------------------------------
              파일전송 시작 로그
         ----------------------------------------------------------------*/
        this.konsoleService.sendMessage(message);
      } else if (message.cmd === 'FOLDER.INFO') {

        this.foldersSize[message.folderData.index] = message.folderData.size;
        //this.logger.debug('FOLDER.INFO', message, this.foldersSize);
      } else if (message.cmd === 'FOLDER.SENT') {
        /*---------------------------------------------------------------
              폴더 전송 완료
         ----------------------------------------------------------------*/
        console.log('homepage -> 폴더전송완료');
        //this.logger.debug(new Date(), message);
        log.info('homepage => 전송완료된 폴더 folderIndex : ', (message.folderIndex -1), );


        if(message.folderIndex < this.maxFolder){
          log.info('다음폴더 업로드 !!');
          this.onStartUploadFolder(message.folderIndex , 5);
        } else {
          console.log('homepage -> 모두완료 다음시간설정');
          this.uploading = false;
          //kimcy: test code
          const minutes =  60 * getRandomInt(1, 4); //5*getRandomInt(1, 4); //60 * getRandomInt(1, 4); //1분부터 4분까지 랜덤
          const interval = 1000 * 60 * minutes;
          const next = moment().add(interval);
          const str = next.format('MM월DD일 HH시 mm분');
          this.konsoleService.sendMessage({
            cmd: 'LOG',
            message: str + '에 백업이 재실행됩니다.'
          });
          this.logger.debug(new Date(), '다음 백업 대기 업로딩? ', this.uploading);
          this.memberAPI.getLoginToken(this.member,this.storageService); //업로드 완료 후 토큰 갱신

          //긴급점검 체크
          if(!this.memberPrivate && this.checkEmergency()){
            var msg = '긴급점검! 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
            this.electronService.ipcRenderer.send('ALERT', {message: msg});
          }
          //7일 점검
          if(!this.memberPrivate && this.checkDay(7)){
            var msg = '7일간 백업된 파일이 없습니다. 프로그램에서 백업버튼을 눌러주세요.';
            this.electronService.ipcRenderer.send('ALERT', {message: msg});
          }

          this.onStartUploadFolder(0, interval / 1000);
        }
      }
    });


    /*---------------------------------------------------------------
     * Storage로부터 값을 받아와서  this.storedFolders를 초기화

    ----------------------------------------------------------------*/
    this.fillFolders(); //??


    /*---------------------------------------------------------------
           등록된 폴더에 대해 업로드를 실행  
           맨처음 로그인하고 불림(1번만)
     ----------------------------------------------------------------*/
    this.timerStart = setTimeout(() => {
        
        // console.log('10초후 등록된 폴더에 대해 업로드를 실행 ??');
        if(this.storageService.get('login') == true){
          //for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
            for (let i = 0; i < this.maxFolder; i++) {
            this.uploading = false;
            console.log('storedFolders = ',this.storedFolders[i]);
            if (this.storedFolders[i] != undefined) {
              console.log('등록된 폴더에 대해 업로드를 실행', this.storedFolders[i].length); //폴더의 이름 길이
              console.log('home-page, member = ', this.member);
              //this.uploadFiletreeService.upload(i, this.storedFolders[i]);
              //this.uploadFiletreeService.getFolderTree(i, this.storedFolders[i],this.member);
              this.onStartUploadFolder(i, 2);
              break;
            }
          }
        }
        
      }, 3000);  //폴더선택

    /*----------------------------------------------------
       *  IPC Response : Get FileTree
       ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('PCRESOURCE', (event: Electron.IpcMessageEvent, response: any) => {
      console.log('받음 home-page, PCRESOURCE, response = ',response);
      this.deviceResource = response;
    });


    /*---------------------------------------------------------------
           LISTENER : SELECTFOLDER의 리스너
     ----------------------------------------------------------------*/

    this.electronService.ipcRenderer.on('SELECTFOLDER', (event: Electron.IpcMessageEvent, response: any) => {
      log.info('받음,home-page, SELECTFOLDER', response, this.uploading);
      //log.info('받음,home-page, SELECTFOLDER = ',response.directory);

      this.electronService.ipcRenderer.removeListener('SELECTFOLDER', (event: Electron.IpcMessageEvent, response: any)=>{
        log.info('SELECTFOLDER, 콜백한번만 호출되게...');
      });

      if (response.directory != null) {

        const folderKey = this.getFolderKey(response.folderIndex);
        this.storageService.set(folderKey, response.directory[0]); //key: 예:folder:pharmbase:0
        this.fillFolders();

        //this.uploadFiletreeService.fillFollders(); 현재는 폴더인덱스만 있으면 됨
        console.log('home-page, uploading?? ', this.uploading)
        if (this.uploading === false) {
          log.info('home-page, SELECTFOLDER ?? folderIndex = ', response.folderIndex)
          this.storageService.set('login',false); 
          this.onStartUploadFolder(response.folderIndex, 3);  //3초후에 업로드
        }
      }

    });


    /*---------------------------------------------------------------
           서버에 저장된 Folder의 File 목록들을 받아온다
           (초기 목록 보여주기 용)
     ----------------------------------------------------------------*/
    this.onTab(0);
  }

}
