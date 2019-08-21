import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { M5MemberService } from '../../services/m5/m5.member.service';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
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


@Component({
  selector: 'app-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})


export class HomePageComponent implements OnInit, OnDestroy {
  private MAXFOLDERLENGTH = 3;
  public version: string;
  private board;
  public member;
  private deviceResource;
  private uploadSubscribe;


  private accessToken;

  public rootFolderName;
  public rootFolderData;
  public parentFolder;

  private foldersSize = new Array(this.MAXFOLDERLENGTH);
  private storedFolders = {};
  public selectedFolderIndex = 0;
  public showingFolderName;
  public showingFileList = [];
  public showingFolderList = [];

  public uploading = false;
  private alertModal: BsModalRef;

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


  private getFolderKey(folderIndex) {
    console.log('home-page, getFolderKey => folderIndex ',folderIndex, this.member.username);
    const key = 'folder:' + this.member.username + ':' + folderIndex;
    //this.logger.debug('FOLDERKEY', key, 'username = ' + this.member.username);
    return key;
  }


  onLogout() {
    console.log('로그아웃버튼 눌림');
    this.uploadFiletreeService.setUploadingStatus(false);
    this.uploading = false;
    this.memberAPI.logout();
    this.router.navigateByUrl('/');
  }

  gotoRoot(){
    this.router.navigateByUrl('/');
  }
  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  탭이 선택됨
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onTab(tabIndex) {
    console.log('탭이 선택됨', tabIndex);
    this.selectedFolderIndex = tabIndex;
    const folderKey = this.getFolderKey(tabIndex);
    const folder = this.storageService.get(folderKey);

    console.log('folderKey = ', folderKey, 'folder = ', folder);

    this.logger.debug('FOLDERNAME', folder, folderKey);
    //kimcy
    //if (folder != null) {
    if (folder != undefined) {
      this.rootFolderName = folder;
      this.showingFolderName = folder;
      //console.log('this.deviceResource = ',this.deviceResource);
      this.onRequestFolderPosts(this.selectedFolderIndex, folder, null);
      if (this.deviceResource == null) {
        setTimeout(() => {
          console.log('2초후 , onRequestFolderData');
          this.onRequestFolderData(this.selectedFolderIndex);
        }, 2000);
      } else {
        console.log('onRequestFolderData');
        this.onRequestFolderData(this.selectedFolderIndex);
      }
    } else {
      //설정한 폴더가 없다면??
      console.log('살정한 폴더가 없음');
      this.rootFolderName = '';
      this.showingFolderName = '';
      this.showingFolderList = [];
      this.showingFileList = [];
    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  폴더 다이얼로그로 선택하기
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onChangeFolder(folderIndex) {
    this.selectedFolderIndex = folderIndex;
    console.log('보냄,home-page, onChangeFolder, SELECTFOLDER');
    this.electronService.ipcRenderer.send('SELECTFOLDER', {
      folderIndex: folderIndex
    });
    this.storageService.set('login',false);

  }


  onRequestFolderData(folderIndex) {
    console.log('home-page, onRequestFolderData');
    if (this.deviceResource == null) {
      this.deviceResource = { macaddress: 'MAC' };
    }
    const folderKey = this.getFolderKey(folderIndex);
    const folder = this.storageService.get(folderKey);
    //kimcy: 추후

    // this.postAPI.list(this.board.id, {
    //   type: 'folderData',
    //   andFields: JSON.stringify({code: this.member.id + '##' + this.deviceResource.macaddress + '##' + folder}),
    //   fetchMode: 'admin'
    // }).subscribe(
    //   response => {
    //     {
    //       this.logger.debug('음***', response);

    //       if (ObjectUtils.isNotEmpty(response.posts)) {
    //         this.rootFolderData = response.posts[0];
    //         if (ObjectUtils.isNotEmpty(this.rootFolderData.userData.error)) {
    //           switch (this.rootFolderData.userData.error) {
    //             case '10days' :
    //             case '5days' :
    //               console.log('5일경과');
    //               this.rootFolderData.userData.errorMessage = '5일경과';
    //               break;
    //             // case '3days' :
    //             //   this.rootFolderData.userData.errorMessage = '3일점검';
    //             //   break;
    //             case 'nozip' :
    //                 console.log('긴급점검');
    //               this.rootFolderData.userData.errorMessage = '긴급점검';
    //               break;
    //           }
    //         }
    //       }
    //     }
    //   },
    //   error => {
    //     if (error.code != null) {
    //     } else {
    //       this.logger.debug('에러', error);
    //     }
    //   }
    // );
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

    this.logger.debug('SUBFOLDER', gotoPath, this.parentFolder);
    //kimcy: 이걸보여주면? 무엇이?
    //this.showingFolderList.push(this.parentFolder); //test code html line95에서 폴더 타이틀 찾는 부분에서 죽는다.

    
 

    //kimcy: 추후 새로..
    // this.postAPI.list(this.board.id, {
    //   type: 'item',
    //   status: this.uploadFiletreeService.getFolderPath(folderIndex),
    //   andFields: JSON.stringify({'userData.parentPath': gotoPath.replace(/\\/g, '/')}),
    //   fetchMode: 'admin'
    // }).subscribe(
    //   response => {
    //     {
    //       console.log('서버응답');
    //       for (const p in response.posts) {
    //         if (response.posts.hasOwnProperty(p)) {
    //           // const folder = path.dirname(response.posts[p].code);
    //           if (response.posts[p].subtype === 'folder') {
    //             this.showingFolderList.push(response.posts[p]);
    //           } else {
    //             this.showingFileList.push(response.posts[p]);
    //           }
    //         }
    //       }
    //     }
    //   },
    //   error => {
    //     console.log('서버응답 에러');
    //     if (error.code != null) {
    //       this.konsoleService.sendMessage({cmd: 'LOG', message: JSON.stringify(error)});
    //     } else {
    //       this.konsoleService.sendMessage({cmd: 'LOG', message: JSON.stringify(error)});
    //     }
    //     /** RETRY **/
    //     setTimeout(() => {
    //       this.onRequestFolderPosts(folderIndex, gotoPath, files);
    //     }, 2000);
    //   }
    // );
  }


  //kimcy: folderIndex 가 0이면 처음부터 시작
  onStartUploadFolder(folderIndex, after) {
    console.log('home-page, onStartUploadFolder, folderIndex = ',folderIndex, 'after = ',after);
    if (after == null) {
      after = 5;
    }
    const folderKey = this.getFolderKey(folderIndex);
    console.log('home-page folderKey = ', folderKey);

    const folder = this.storageService.get(folderKey);
    console.log('home-page folder = ', folder, 'folderKey = ', folderKey);

    //kimcy: 일단은 여기서 목록을 만들어서 저장한다.
    console.log('folderIndex = ',folderIndex,'uploading = ',this.uploading);
    if(folderIndex == 0 && (this.uploading === false)){
      console.log('업로딩 시작으로 목록갱신');
      this.uploadFiletreeService.getContainerList(this.storageService);
    }

    setTimeout(() => {
      console.log('setTimeout, folderIndex = ', folderIndex);
      this.uploading = true;
      this.uploadFiletreeService.upload(folderIndex, folder);
    }, after * 1000);  //여기서 시간값을 바꾸면 시작값이 안 맞는다.(다음폴더는 5초후에), 백업시작버튼누르면 3초후에, 다음번은 1~4시간안에
  }

  fillFolders() {
    console.log('home-page, fillFolders');
    for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey); //선택한폴더
      if (this.selectedFolderIndex === i) {
        this.showingFolderName = this.storedFolders[i];
      }
    }
  }

  ngOnDestroy() {
    console.log('home-page, ngOnDestroy');
    this.uploadSubscribe.unsubscribe();
  }


  ngOnInit() {
    console.log('home-page, ngOnInit');
    this.version = environment.VERSION;
    this.electronService.ipcRenderer.send('PCRESOURCE', null);
    console.log('보냄 home-page, PCRESOURCE');
    this.logger.debug('- HOMEPAGE ngOnInit: ', this.version);

    this.member = this.memberAPI.isLoggedin();

    function getRandomInt(min, max) {
      console.log('home-page, getRandomInt');
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    //kimcy:test
    // var div1 = window.document.getElementsByClassName('tab-container');
    // var node = div1.namedItem
    // console.log('div1 =',node);

    /*---------------------------------------------------------------
           Subscribe to notification
     ----------------------------------------------------------------*/
    //  this.uploadSubscribe = this.uploadFiletreeService.notified().subscribe(message => {

    //  });
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
        this.logger.debug('FOLDER.INFO', message, this.foldersSize);
      } else if (message.cmd === 'FOLDER.SENT') {
        /*---------------------------------------------------------------
              폴더 전송 완료
         ----------------------------------------------------------------*/
        console.log('homepage -> 폴더전송완료');
        this.logger.debug(new Date(), message);
        console.log('homepage => 전송완료된 폴더 folderIndex : ', message.folderIndex);
        if (this.MAXFOLDERLENGTH - 1 > message.folderIndex) {

          console.log('다음 폴더 homepage -> this.storedFolders[message.folderIndex]', this.storedFolders[message.folderIndex]);
          console.log('다음 폴더 homepage -> this.selectedFolderIndex', this.selectedFolderIndex);
          // update
          //kimcy: 없어도 될듯해서.
          // if (this.storedFolders[message.folderIndex] !== undefined && (message.folderIndex === this.selectedFolderIndex)) {
          //   console.log('여긴??, 업로드된 폴더의 결과를 확인??');
          //   this.onRequestFolderPosts(message.folderIndex, this.storedFolders[message.folderIndex], null);
          // }

          this.onStartUploadFolder(message.folderIndex + 1, 5);
        } else if(message.cmd === 'LIST.COMPLETE'){
          //kimcy token 갱신
          if (this.electronService.isElectronApp){
            this.member = this.memberAPI.isLoggedin();
            if(this.member === undefined){
              //로그인
              this.router.navigateByUrl('/login');
              return;
            }else{
              console.log('새로운 토큰 가져오기');
              this.memberAPI.getLoginToken(this.member,this.storageService);
            }
          }
        } else {

          //kimcy: 기존의 목록을 지워야 한다.
          //this.storageService.remove('list');
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
          this.onStartUploadFolder(0, interval / 1000);

        }


      }
    });


    /*---------------------------------------------------------------
              Storage로부터 값을 받아와서  this.storedFolders를 초기화
    ----------------------------------------------------------------*/
    for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
      console.log('Storage로부터 값을 받아와서  this.storedFolders를 초기화');
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey);
    }

    /*---------------------------------------------------------------
           등록된 폴더에 대해 업로드를 실행  (현재는 모두 다시 올림)
           로그아웃 후 로그인 하는 경우
     ----------------------------------------------------------------*/

    setTimeout(() => {
      
      console.log('5초후 등록된 폴더에 대해 업로드를 실행 ??');
      //this.uploadFiletreeService.upload(0, this.storedFolders[0]);
      if(this.storageService.get('login') == true){
        for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
          this.uploading = false;
          console.log('storedFolders = ',this.storedFolders[i]);
          if (this.storedFolders[i] != undefined) {
            console.log('등록된 폴더에 대해 업로드를 실행', this.storedFolders[i].length); //폴더의 이름 길이
            this.uploadFiletreeService.upload(i, this.storedFolders[i]);
            break;
          }
        }
      }
      
    }, 10000);  //폴더선택후 3초후에 업로드시작이기때문에 처음로그인해서는 5초보다는 길어야.. 10초후

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
      this.logger.debug('SELECTFOLDER', response, this.uploading);
      console.log('받음,home-page, SELECTFOLDER');
      if (response.directory != null) {
        console.log('home-page, directory', response.directory);
        const folderKey = this.getFolderKey(response.folderIndex);

        console.log('home-page, SELECTFOLDER => folderKey', folderKey);

        this.storageService.set(folderKey, response.directory[0]); //key: folder:pharmbase:0
        this.fillFolders();

        this.uploadFiletreeService.fillFollders();
        console.log('home-page, uploading?? ', this.uploading)
        if (this.uploading === false) {
          console.log('home-page, SELECTFOLDER ?? folderIndex = ', response.folderIndex)
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

    // const folderPath = this.uploadFiletreeService.getFolderPath(this.selectedFolderIndex);
    // if (folderPath == null) {
    //   return;
    // } else {
    //   this.rootFolderName = folderPath;
    //   this.onRequestFolderPosts(0, this.uploadFiletreeService.getFolderPath(0), null);
    // }
  }

}
