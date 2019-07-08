import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {M5MemberService} from '../../services/m5/m5.member.service';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import {ElectronService} from 'ngx-electron';
import {M5PostService} from '../../services/m5/m5.post.service';
import {UploadFiletreeService} from '../../services/upload.filetree.service';
import {BsModalRef, BsModalService, ModalModule} from 'ngx-bootstrap';
import * as path from 'path';
import {KonsoleService} from '../../services/konsole.service';
import * as moment from 'moment';
import {ObjectUtils} from '../../utils/ObjectUtils';
import {NGXLogger} from 'ngx-logger';
import {environment} from '../../../environments/environment';


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
    const key = 'folder:' + this.member.id + ':' + folderIndex;
    this.logger.debug('FOLDERKEY', key);
    return key;
  }


  onLogout() {
    this.memberAPI.logout();
    this.router.navigateByUrl('/');
  }


  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  탭이 선택됨
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onTab(tabIndex) {
    this.selectedFolderIndex = tabIndex;
    const folderKey = this.getFolderKey(tabIndex);
    const folder = this.storageService.get(folderKey);

    this.logger.debug('FOLDERNAME', folder, folderKey);
    if (folder != null) {
      this.rootFolderName = folder;
      this.showingFolderName = folder;
      this.onRequestFolderPosts(this.selectedFolderIndex, folder, null);
      if (this.deviceResource == null) {
        setTimeout(() => {
          this.onRequestFolderData(this.selectedFolderIndex);
        }, 2000);
      } else {
        this.onRequestFolderData(this.selectedFolderIndex);
      }
    } else {
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
    this.electronService.ipcRenderer.send('SELECTFOLDER', {
      folderIndex: folderIndex
    });
  }


  onRequestFolderData(folderIndex) {
    if (this.deviceResource == null) {
      this.deviceResource = {macaddress: 'MAC'};
    }
    const folderKey = this.getFolderKey(folderIndex);
    const folder = this.storageService.get(folderKey);

    this.postAPI.list(this.board.id, {
      type: 'folderData',
      andFields: JSON.stringify({code: this.member.id + '##' + this.deviceResource.macaddress + '##' + folder}),
      fetchMode: 'admin'
    }).subscribe(
      response => {
        {
          this.logger.debug('*******', response);

          if (ObjectUtils.isNotEmpty(response.posts)) {
            this.rootFolderData = response.posts[0];
            if (ObjectUtils.isNotEmpty(this.rootFolderData.userData.error)) {
              switch (this.rootFolderData.userData.error) {
                case '10days' :
                case '5days' :
                  this.rootFolderData.userData.errorMessage = '5일경과';
                  break;
                // case '3days' :
                //   this.rootFolderData.userData.errorMessage = '3일점검';
                //   break;
                case 'nozip' :
                  this.rootFolderData.userData.errorMessage = '긴급점검';
                  break;
              }
            }
          }
        }
      },
      error => {
        if (error.code != null) {
        } else {
          this.logger.debug('에러', error);
        }
      }
    );
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   *  Get FileTree from server
   -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  onRequestFolderPosts(folderIndex, gotoPath, files) {

    if (gotoPath === undefined) {
      return;
    }

    this.showingFolderName = gotoPath;
    this.showingFolderList = [];
    this.showingFileList = [];
    const paths = path.dirname(gotoPath).split(path.sep);
    this.parentFolder = paths.slice(0, paths.length).join('/');

    this.logger.debug('SUBFOLDER', gotoPath, this.parentFolder);
    this.postAPI.list(this.board.id, {
      type: 'item',
      status: this.uploadFiletreeService.getFolderPath(folderIndex),
      andFields: JSON.stringify({'userData.parentPath': gotoPath.replace(/\\/g, '/')}),
      fetchMode: 'admin'
    }).subscribe(
      response => {
        {
          for (const p in response.posts) {
            if (response.posts.hasOwnProperty(p)) {
              // const folder = path.dirname(response.posts[p].code);
              if (response.posts[p].subtype === 'folder') {
                this.showingFolderList.push(response.posts[p]);
              } else {
                this.showingFileList.push(response.posts[p]);
              }
            }
          }
        }
      },
      error => {
        if (error.code != null) {
          this.konsoleService.sendMessage({cmd: 'LOG', message: JSON.stringify(error)});
        } else {
          this.konsoleService.sendMessage({cmd: 'LOG', message: JSON.stringify(error)});
        }
        /** RETRY **/
        setTimeout(() => {
          this.onRequestFolderPosts(folderIndex, gotoPath, files);
        }, 2000);
      }
    );
  }


  onStartUploadFolder(folderIndex, after) {

    if (after == null) {
      after = 5;
    }
    const folderKey = this.getFolderKey(folderIndex);
    const folder = this.storageService.get(folderKey);

    setTimeout(() => {
      this.uploading = true;
      this.uploadFiletreeService.upload(folderIndex, folder);
    }, after * 1000);
  }

  fillFolders() {
    for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey);
      if (this.selectedFolderIndex === i) {
        this.showingFolderName = this.storedFolders[i];
      }
    }
  }

  ngOnDestroy() {
    this.uploadSubscribe.unsubscribe();
  }


  ngOnInit() {
    this.version = environment.VERSION;
    this.electronService.ipcRenderer.send('PCRESOURCE', null);
    this.logger.debug('-=-=-=HOMEPAGE : ', this.version);
    this.board = this.storageService.get('board');
    this.member = this.memberAPI.getLoggedin();
    this.accessToken = this.storageService.get('accessToken');

    function getRandomInt(min, max) {
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
        this.logger.debug(new Date(), message);
        if (this.MAXFOLDERLENGTH - 1 > message.folderIndex) {

          // update
          if (this.storedFolders[message.folderIndex] !== undefined && (message.folderIndex === this.selectedFolderIndex)) {
            this.onRequestFolderPosts(message.folderIndex, this.storedFolders[message.folderIndex], null);
          }
          this.onStartUploadFolder(message.folderIndex + 1, 5);
        } else {
          this.uploading = false;

          const minutes = 60 * getRandomInt(1, 4);
          const interval = 1000 * 60 * minutes;
          const next = moment().add(interval);
          const str = next.format('MM월DD일 HH시 mm분');
          this.konsoleService.sendMessage({
            cmd: 'LOG',
            message: str + '에 백업이 재실행됩니다.'
          });

          this.logger.debug(new Date(), '다음 백업 대기');
          this.onStartUploadFolder(0, interval / 1000);
        }


      }
    });


    /*---------------------------------------------------------------
              Storage로부터 값을 받아와서  this.storedFolders를 초기화
    ----------------------------------------------------------------*/
    for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
      const folderKey = this.getFolderKey(i);
      this.storedFolders[i] = this.storageService.get(folderKey);
    }

    /*---------------------------------------------------------------
           등록된 폴더에 대해 업로드를 실행  (현재는 모두 다시 올림)
     ----------------------------------------------------------------*/
    setTimeout(() => {
      for (let i = 0; i < this.MAXFOLDERLENGTH; i++) {
        if (this.storedFolders[i] != null) {
          this.uploadFiletreeService.upload(i, this.storedFolders[i]);
          break;
        }
      }
    }, 5000);

    /*----------------------------------------------------
       *  IPC Response : Get FileTree
       ----------------------------------------------------*/
    this.electronService.ipcRenderer.on('PCRESOURCE', (event: Electron.IpcMessageEvent, response: any) => {
      this.deviceResource = response;
    });


    /*---------------------------------------------------------------
           LISTENER : SELECTFOLDER의 리스너
     ----------------------------------------------------------------*/

    this.electronService.ipcRenderer.on('SELECTFOLDER', (event: Electron.IpcMessageEvent, response: any) => {
      this.logger.debug('SELECTFOLDER', response, this.uploading);
      if (response.directory != null) {
        const folderKey = this.getFolderKey(response.folderIndex);


//        this.storedFolders[response.folderIndex] = response.directory[0];
        this.storageService.set(folderKey, response.directory[0]);
        this.fillFolders();

        this.uploadFiletreeService.fillFollders();
        if (this.uploading === false) {
          this.onStartUploadFolder(response.folderIndex, 3);
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
