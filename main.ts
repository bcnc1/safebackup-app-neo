import { isFormattedError, ConditionalExpr } from "@angular/compiler";
import {environment} from './src/environments/environment';
import { Router } from '@angular/router';
import { Inject, Injectable } from '@angular/core';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import { createInjectable } from "@angular/compiler/src/core";
import { userInfo } from "os";
import { LoggerConfig } from "ngx-logger";
import * as moment from 'moment';


const {app, BrowserWindow, ipcMain} = require("electron");
const fs = require("fs");
const url = require("url");
const os = require("os");

const path = require("path");

const { localStorage, sessionStorage } = require('electron-browser-storage');

const checkDiskSpace = require("check-disk-space");
const request = require('request');
const electron = require('electron');
const Tray = require('electron').Tray;
const Menu = require('electron').Menu;
const dialog = electron.dialog;
const log = require('electron-log');
const updater = require('electron-simple-updater');
//kimcy
const reqestProm = require('request-promise-native')

var AutoLaunch = require('auto-launch');

const chokidar = require('chokidar');

let isQuiting = false;

var knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: app.getPath('userData')+'/'+ 'sb.db',
    timezone     : 'utc',   //time존 적용을 연구해야..
  }
});
var member;
//const env = environment;
const  async = require("async");
const zipper = require('zip-local');
//console.log('knex = ',knex);
//const storageService = LOCAL_STORAGE;
const STORAGE_URL = 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3'

if (handleSquirrelEvent(app)) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  app.exit(0); //return;
}
let mainWindow;

var drBackupAutoLauncher = new AutoLaunch({
  name: 'safebackup'
});
drBackupAutoLauncher.enable();


// function logger(level, text) {
//   log.warn(level, text);
// }


/* 글로벌로 해야  garbage colllection이 안된다고함 */
let tray = null;
let contextMenu = null;

function createWindow() {
  console.log('createWindow');
  /*---------------------------------------------------------------
               TRAY
   ----------------------------------------------------------------*/
   tray = new Tray(path.join(__dirname, '/dist/assets/icons/tray-icon.png'));
   contextMenu = Menu.buildFromTemplate([
     {
       label: '보기',
       click: function () {
         mainWindow.show();
       }
     },
     {
       label: '종료',
       click: function () {
         isQuiting = true;
         console.log('트레이종료');
         app.quit();
       }
     }
   ]);
 
   tray.setToolTip('안심백업 v3.0');
   tray.setContextMenu(contextMenu);
 
   tray.on('click', function (e) {
     setTimeout(function () {
       mainWindow.minimize();
     }, 3000);
   });
   contextMenu.on('menu-will-close', (event) => {
     for (let item of event.sender.items) {
       if (item.checked) log.warn("Menu item checked:", item.label)
     }
   });
 
   /*---------------------------------------------------------------
              Main Window
    ----------------------------------------------------------------*/

   mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false
    },
    autoHideMenuBar: true
  });

   mainWindow.loadURL(
     url.format({
       pathname: path.join(__dirname, `/dist/index.html`),
       protocol: "file:",
       slashes: true
     })
   );
 
   //kimcy: release 할때는 해당 부부을 false, 개발할때는 true
   function isDev() {
     return true;
   };
 
   // The following is optional and will open the DevTools:
   if (isDev()) {
     mainWindow.webContents.openDevTools();
   } else {
     //kimcy: 3초후에 사라지게 요청
    setTimeout(function () {
      mainWindow.minimize();
      log.warn('MINIMIZE');
    }, 3000);
 
   }
 
   app.on('before-quit', function (e) {
     // Handle menu-item or keyboard shortcut quit here
     if (isQuiting == true) {
       log.warn('before-quit ===>QUIT', isQuiting);
       mainWindow.destory();
       if(mainWindow.isDestroyed()){
        log.warn('before-quit 윈도우 종료 안됨');
       }else{
        log.warn('before-quit 윈도우 종료 ');
       }
     } else {
       log.warn('before-quit ==>HIDE', isQuiting);
     }
   });
 
   mainWindow.on('close', function (e) {
     log.warn('close ==> isQuiting?', isQuiting);
     if(mainWindow.isDestroyed()){
      log.warn('close 윈도우 종료 안됨');
     }else{
      log.warn('close 윈도우 종료 ');
     }
     if (isQuiting == true) {
       return true;
     } else {
       mainWindow.hide();
       e.preventDefault();  //여기서 이거 안하고 show 하면 문제 생김
       return false;
     }
   });
 
   mainWindow.onbeforeunload = function (e) {
    alert("onbeforeunload => 본 프로그램은 종료가 불가능합니다.")
    e.preventDefault();
    return false;
   };
 
   
   /*---------------------------------------------------------------
            Updater
            kimcy: 업데이트 기능없음
    ----------------------------------------------------------------*/
  //  try {
  //    updater.init({
  //      url: 'http://version.doctorkeeper.com/safe4.json',
  //      autoDownload: false,
  //      checkUpdateOnStart: true,
  //      logger: {
  //        info(text) {
  //          logger('info', text);
  //        },
  //        warn(text) {
  //          logger('warn', text);
  //        }
  //      }
  //    });
 
 
  //    log.warn('AUTOUPDATE initialized');
  //    updater.on('update-available', meta => {
  //      log.warn('[updater] update available', meta.version);
  //      updater.downloadUpdate()
  //    });
 
 
  //    updater.on('update-downloading', (e) => {
  //      log.warn('downloading', e)
  //    });
 
  //    updater.on('update-downloaded', () => {
  //      isQuiting = true;
  //      updater.quitAndInstall();
  //      setTimeout(() => {
  //        app.relaunch();
  //        app.exit(0);
  //      }, 3 * 60 * 1000);
  //    });
 
  //    updater.on('update-not-available', (e) => {
  //      log.warn('there is no available update', e)
  //    });
  //    updater.on('error', err => {
  //      log.warn(err)
  //    });
 
 
  //    setInterval(function () {
  //      updater.checkForUpdates();
  //      log.warn('CHECKED VERSION');
  //    }, 60 * 60 * 1000);
 
  //    updater.checkForUpdates();
  //  } catch (e) {
  //    log.warn(e);
  //  }

}

try {

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.

  //kimcy
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

 app.on('ready', ()=> {
  console.log('Ready');
  createWindow();
  createSBDatabBase();
 });
}

//kimcy: 인스턴스 여러개..
//  app.on('ready', ()=> {
//   console.log('Ready');
//   createWindow();
//   createSBDatabBase();
//  });

  // Quit when all windows are closed.
  // kimcy 강제종료는 tray에서만 하는것으로??
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      log.warn('window-all-closed ==> CLOSING????', isQuiting);
      if (isQuiting == true) {
        isQuiting = false;
      } else {
        mainWindow.hide();
        isQuiting = false;
      }
  
    }
  });

  app.on('quit', ()=> {
    console.log('quit 완전종료');
    if(mainWindow.isDestroyed()){
      log.warn('quit 윈도우 종료 안됨');
     }else{
      log.warn('quit 윈도우 종료 ');
     }

  });
  //kimcy
  app.on('will-quit', () => {
    if (process.platform !== 'darwin') {
      log.warn('will-quit ==> CLOSING????', isQuiting);
      if(mainWindow.isDestroyed()){
        log.warn('will-quit 윈도우 종료 안됨');
       }else{
        log.warn('will-quit 윈도우 종료 ');
       }
  
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  DataBase
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 var sqlite3 = require('sqlite3').verbose();
 
 function createSBDatabBase(){
  localStorage.getItem('member').then((value) => {
    member = JSON.parse(value);
    

    if (fs.existsSync(app.getPath('userData')+'/'+ 'sb.db')) {
      console.log('exists');
    } else{
      console.log('does not');
      var db = new sqlite3.Database(app.getPath('userData')+'/'+ 'sb.db');
      db.close();
    }
  });

 }

 function createTable(tableName, window, callback){
   console.log('createTable');

      //timezone 챀고
      //https://stackoverflow.com/questions/46152833/timestamp-fields-in-knex-js-migrations
      knex.schema.hasTable(tableName).then(function(exists) {
        log.info('createTable, exists = ',exists);
        if (!exists) {
          knex.schema.createTable(tableName, function(t) {
            t.increments('id').primary();
            t.text('filename');
            t.integer('filesize');
            t.time('fileupdate',{useTz: true}); //2019-07-25T07:02:31.587Z 저장이되어야 하느데
            t.integer('uploadstatus'); //0: 초기값(업로드해야), 1: 업로드완료 2:업데이트(아직업로드안됨, 업로드되면 1)
            t.integer('chainstatus'); //0: 초기값(업로드해야), 1: 업로드 완료, 2: 업로드에러 
           // t.string('time');
          }).then(()=>{
            log.info('11..callback true');
            callback(true);
          }).catch(()=>{
            callback(false);
          });
        }else{
          log.info('22..callback true');
          callback(true);
        }
      });

 }

 const MaxByte = 5*1024*1024*1024;
 function addFileFromDir(arg, window, callback){
  //console.log('addFileFromDir => folderIndex = ', arg);
  var tableName = arg.username+':'+arg.folderIndex;
  const watcher = chokidar.watch(arg.path, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    //persistent: false,
    interval: 400,
  });

  var result = [];
  watcher
    .on('add', function(path, stats){
      //log.info('add path = ',path, 'stats = ',stats);
      result.push({
        fullpath: path,
        size: stats.size,
        updated: stats.mtime
      })
    })
    //.on('addDir', path => log.info(`Directory ${path} has been added`))
    .on('error', ()=>{
      log.error('watcher error');
    })
    .on('ready', function() 
    { 
      log.info('Initial scan complete. Ready for changes.');
      //log.info('result = ', result);
      log.info('tableName = ', tableName);
      async.eachSeries(result, function(item, next) {
        

        //log.info('item = ', item);
        if(item.fullpath.toLowerCase().lastIndexOf('npki') > 0 && item.fullpath.lastIndexOf('.zip') < 0 ){  //npki 내부 파일들은 zip으로 압축해서 올려야 하기때문
          //var ft = moment().add(interval);
          knex(tableName)
          .insert({filename: item.fullpath, filesize : item.size, 
            fileupdate: item.updated, uploadstatus: 1, chainstatus: 1 })
          .then(()=>{
           log.info('npki폴더내 파일 처리(zip제외)');
           localStorage.getItem('member').then((value) => {
             if(value != null){
              next();
             }
           });
           //next();
          });
        }else{
          knex(tableName)
          .where('filename', item.fullpath)
          .then((results)=>{
            if(results.length == 0 ){
              //log.info('22..일치하는 값 없음 = results = ', results);
              //5g이상은 업로드로 처리
              if(item.size >= MaxByte){
                  knex(tableName)
                .insert({filename: item.fullpath, filesize : item.size, 
                  fileupdate: item.updated, uploadstatus: 1, chainstatus: 1})
                .then(()=>{
                  localStorage.getItem('member').then((value) => {
                    if(value != null){
                    next();
                    }
                  });
                });
              }else{
                knex(tableName)
                .insert({filename: item.fullpath, filesize : item.size, 
                  fileupdate: item.updated, uploadstatus: 0, chainstatus: 0})
                .then(()=>{
                  localStorage.getItem('member').then((value) => {
                    if(value != null){
                     next();
                    }
                  });
                });
              }
              
            }else{
              
             //log.info('업데이트 준비, results = ', results , 'item = ',item);
             
             for(var i =0; i< results.length; i++){

                var id = results[i]['id'];
                var fsize = results[i]['filesize'];
                var fupdate = results[i]['fileupdate']; //utc값으로 기록안되어 추후구현
                var uploadstatus = results[i]['uploadstatus'];
                var chainstatus = results[i]['chainstatus'];

                if(fsize != item.size){
                  if(uploadstatus == 0){
                    log.info('업로드 전/실패, 파일변경 = ', item.fullpath);
                    knex(tableName)
                    .where({id: id})
                    .update({filesize: item.size}).then((result)=>{
                        log.info('결과 = ',result);
                      });
                  }else if(uploadstatus == 1 && (chainstatus == 2 || chainstatus == 0)){
                    log.info('업로드 완료, 블록체인 실패, 파일변경 = ', item.fullpath, '체인은 = ',chainstatus);
                    knex(tableName)
                    .where({id: id})
                    .update({filesize: item.size}).then((result)=>{
                        log.info('결과 = ',result);
                      });
                  } else if(uploadstatus == 1 && chainstatus == 1){
                    log.info('업데이트목록으로, 파일변경 = ', item.fullpath);
                    if(item.size < MaxByte){
                      knex(tableName)
                      .where({id: id})
                      .update({filesize: item.size, fileupdate: item.update
                        , uploadstatus: 2, chainstatus: 0})
                      .then((result)=> {
                        log.info('결과 = ',result);
                      });
                    }
                    // knex(tableName)
                    // .where({id: id})
                    // .update({filesize: item.size, fileupdate: item.update
                    //   , uploadstatus: 2, chainstatus: 0})
                    // .then((result)=> {
                    //   log.info('결과 = ',result);
                    // });
                  }else{
                    log.info('체크 => results = ',results, 'item = ',item);
                  }
                }



                // if(uploadstatus == 0 && fsize != item.size){  
                //   //업로드 되기 전에 변경되었음 create로..
                //   knex(tableName)
                //     .where({id: id})
                //     .update({filesize: item.size, fileupdate: item.update
                //       , uploadstatus: 1,  chainstatus: 0}).then((result)=>{
                //         log.info('업로드 안됨 상태는 업로드 = ',item.fullpath, '결과 = ',result);
                //       });
                // } else if(uploadstatus == 1 && chainstatus == 2){

                // }
                
                
                
                // else if(uploadstatus == 1 && fsize != item.size){
                //   //업로드된 후 변경되었음 update..
                //   knex(tableName)
                //     .where({id: id})
                //     .update({filesize: item.size, fileupdate: item.update
                //       , uploadstatus: 2, chainstatus: 0})
                //     .then((result)=> {
                //       log.info('업로드되어있음으로 상태는 업데이트 = ',item.fullpath, '결과 = ',result);
                //     });

                // }else{
                //   log.info('체크 => results = ',results, 'item = ',item);
                // }

             }
             
             //변경사항 체크 완료 
             localStorage.getItem('member').then((value) => {
              if(value != null){
              next();
              }
            });

              // knex(tableName)
              // .where({filename: item.fullpath}).select('id')
              // .then((result)=>{
              //    var id = results[0]['id'];
              //    var fsize = results[0]['filesize'];
              //    var fupdate = results[0]['fileupdate']; //utc값으로 기록안되어 추후구현
                
              //    if(fsize != item.size /*|| fupdate != item.updated*/){
              //       knex(tableName)
              //       .where({id: id})
              //       .update({filesize: item.size, fileupdate: item.update
              //         , uploadstatus: 2, /*chain: "update",*/ chainstatus: 0})
              //       .then((result)=> {
              //         log.info('업데이트, result = ',result);
              //         localStorage.getItem('member').then((value) => {
              //           if(value != null){
              //            next();
              //           }
              //         });
              //        // next();
              //       });
              //    }else{
              //    // log.info('변경없음 = ',result);
              //     localStorage.getItem('member').then((value) => {
              //       if(value != null){
              //       next();
              //       }
              //     });
              //     //next();
              //    }
              // });
            }
          });
        }

    }, function(err) {
      log.info("끝 = ", err);
      watcher.close();
      callback(true);
    })

  })

 }

 function createNPKIzip(selectedPath, username){
  let filename;
  var date = new Date(); 
  var year = date.getFullYear(); 
  var month = new String(date.getMonth()+1); 
  var day = new String(date.getDate()); 
  
  // 한자리수일 경우 0을 채워준다. 
  if(month.length == 1){ 
    month = "0" + month; 
  } 
  if(day.length == 1){ 
    day = "0" + day; 
  } 
  
  var toDay = year.toString() + month + day;

  if(month.length == 1){ 
    month = "0" + month; 
  } 
  if(day.length == 1){ 
    day = "0" + day; 
  } 
  
  var toDay = year.toString() + month + day;

  filename = toDay+'-'+username+'-'+'NPKI';

  log.info('filename = ',filename);

  var filepath = selectedPath + '/' + filename + '.zip';

  log.info('filepath = ',filepath);
  try{
    var files = fs.readdirSync(selectedPath);
    for(var i in files) {

      if(files[i].toLowerCase().lastIndexOf('.zip') > 0){
        fs.unlinkSync(selectedPath +'/'+files[i]);
        log.info('zip파일 삭제');
      }else{
        //console.log('zip파일 아님');
      }
      
    }
  }catch(err){
    log.error('zip파일 실패');
  }
  
  try{
    zipper.sync.zip(selectedPath).compress().save(filepath);
    log.info('zip파일 성공');
  } catch(err){
    log.error('zip파일 압축 실패');
  }
 }
 
 /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : ADD-ZIPFILE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
//  ipcMain.on("ADD-ZIPFILE", (event, arg) => {

//  });
/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : REQ-UPDATETREE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on("REQ-UPDATETREE", (event, arg) => {
  console.log('받음, REQ-UPDATETREE, main folderIndex = ',arg.folderIndex);
  var tableName = arg.username+':'+arg.folderIndex;

    knex(tableName).where({
      uploadstatus: 2
    }).then((results)=>{
      log.info(' 조회 결과  = ', results);
      if(mainWindow && !mainWindow.isDestroyed()){
        //log.info('보냄 CHAINTREE, main ', results);
        mainWindow.webContents.send("UPDATETREE", {tree:results});
      }
    })
 });

 /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : REQ-UPLOADTREE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on("REQ-UPLOADTREE", (event, arg) => {
  console.log('받음, REQ-UPLOADTREE, main folderIndex = ',arg.folderIndex);
  var tableName = arg.username+':'+arg.folderIndex;

    knex(tableName).where({
      uploadstatus: 0
    }).then((results)=>{
      //log.info(' UPLOADTREE, 조회 결과  = ', results);
      if(mainWindow && !mainWindow.isDestroyed()){
        log.info('보냄 UPLOADTREE, main ', results);
        mainWindow.webContents.send("UPLOADTREE", {tree:results});
      }
    })
 });


 /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : REQ-CHAINTREE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on("REQ-CHAINTREE", (event, arg) => {
  console.log('받음, REQ-CHAINTREE, main folderIndex = ',arg.folderIndex);
  var tableName = arg.username+':'+arg.folderIndex;

    knex(tableName)
    .where({uploadstatus: 1})
    .whereNot({
      chainstatus: 1   
    }).then((results)=>{
      log.info('블록체인 조회 결과  = ', results);
      if(mainWindow && !mainWindow.isDestroyed()){
        log.info('보냄 CHAINTREE, main ', results);
        mainWindow.webContents.send("CHAINTREE", {tree:results});
      }
    })
 });


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : GET FILES
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

 ipcMain.on("GETFOLDERTREE", (event, arg) => {
  
  log.info('받음, GETFOLDERTREE, arg = ',arg);
  if (arg.path == null) {  //이게 없으면 watcher동작 안함
    console.log('arg.path == null');
    return;
  }

  //log.info('선택한 폴더는 = ', arg.path);
  //zip파일 생성
  if(arg.path.toLowerCase().lastIndexOf('npki') > 0){
    log.info('zip파일생성');
    createNPKIzip(arg.path, arg.username);
  }

  addFileFromDir(arg, mainWindow, (result)=>{
    log.info('폴더 트리 결과 = ',result);
    localStorage.getItem('member').then((value) => {
      log.info('로그아웃 => ', value);
      if(value == null){
        return;
      }
    });

    localStorage.setItem('fscan','end').then(()=>{
      log.info('폴더스캔완료');
    })

    if(mainWindow && !mainWindow.isDestroyed()){
      log.info('GETFOLDERTREE => 젆송 ');
      mainWindow.webContents.send("GETFOLDERTREE", "Complete Scanning Folder");
    }
  });
 
});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SEND-FILE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on("SEND-FILE", (event, arg) => {
  console.log('받음, main, SEND-FILE ');
  
  try {
    fileupload(arg);
  } catch (e) {
    log.error('SEND-FILE',e);
  }

});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SEND-CHAINFILE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on("SEND-CHAINFILE", (event, arg) => {
  console.log('받음, main, SEND-CHAINFILE ');
  try {
    chainupload(arg);
  } catch (e) {
    log.error('에러, SEND-CHAINFILE',e);
  }
});


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SEND FILE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
// ipcMain.on("SENDFILE", (event, arg) => {
//   console.log('받음, main, SENDFILE => token:', arg.accessToken);
//   try {
//     sendFile(arg.index, arg.formData, arg.file, arg.accessToken, arg.username);
//   } catch (e) {
//     console.log(e);
//   }
// });


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : ALERT
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
ipcMain.on("ALERT", (event, arg) => {
  //console.log(arg);
  mainWindow.show();
  const response = dialog.showMessageBox(arg);
});


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : PC RESOURCE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
ipcMain.on('PCRESOURCE', (event, arg) => {

  console.log('받음 main, PCRESOURCE');
  var interfaces = os.networkInterfaces();

  log.info('interfaces = ',interfaces);

  var maps = Object.keys(interfaces)
    .map(x => interfaces[x].filter(x => x.family === 'IPv4' && !x.internal)[0])
    .filter(x => x);

  let ipaddress = null;
  let macaddress = null;


  log.info('maps =>',maps);
  if(maps != null) {
    ipaddress = maps[0].address;
    macaddress = maps[0].mac;
  }

  log.info('ipaddress = ',ipaddress);
  log.info('macaddress = ',macaddress);


  if(mainWindow && !mainWindow.isDestroyed()){
    log.info('보냄 main, PCRESOURCE');
    mainWindow.webContents.send("PCRESOURCE", {
      ipaddresses: maps,
      ipaddress: ipaddress,
      macaddress: macaddress
    });
  }

  //const cpus = os.cpus();


  //const path = os.platform() === 'win32' ? 'C:/' : '/';

  // checkDiskSpace(path).then((diskSpace) => {
    
  //   if(mainWindow && !mainWindow.isDestroyed()){
  //     log.info('보냄 main, PCRESOURCE');
  //     mainWindow.webContents.send("PCRESOURCE", {
  //       cpus: cpus,
  //       disk: diskSpace,
  //       ipaddresses: maps,
  //       ipaddress: ipaddress,
  //       macaddress: macaddress
  //     });
  //   }

  // });


});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : get A FOLDER size
 *  
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 ipcMain.on('REQ-DIRSIZE', (event, arg) => {
  var tableName = arg.username +':'+arg.folderIndex;
  knex(tableName).sum('filesize')
  .then((result)=>{
    log.info('폴더사이즈 , folderIndex =  ',arg.folderIndex, 'size = ', result);
    //console.log('사이즈 = ', result.sum(`filesize`));
    //console.log('사이즈 = ', result[0]['sum(`filesize`)']);
    mainWindow.webContents.send("DIRSIZE", {
      error: null,
      folderIndex: arg.folderIndex,
      dirsize: result[0]['sum(`filesize`)']
    });
  });
 });
/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SELECT A FOLDER
 *  폴더 선택 이벤트 처리
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
ipcMain.on('SELECTFOLDER', (event, arg) => {
  console.log('받음,main, SELECTFOLDER');
  var directory = dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']

  });


  var tableName = arg.username +':'+arg.folderIndex;

  log.info('tableName = , tableName');

  if(mainWindow && !mainWindow.isDestroyed()){
    
    var tableName = arg.username +':'+arg.folderIndex;
    //db생성
    //db table 생성
    createTable(tableName, mainWindow,(result) => {
      log.info('보냄,main, SELECTFOLDER');

      if(result){
        log.info('result = ',result);
        mainWindow.webContents.send("SELECTFOLDER", {
          error: null,
          folderIndex: arg.folderIndex,
          directory: directory
        });
      }else{
        log.error('데이터베이스 생성 실패');
      }
      
    });
  }
});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  chain upload
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 var chainupload = function (arg){
   console.log('블록체인 기록을 위한 api');
  let method, url;

  if(arg.uploadtype == 'chain-create' || arg.uploadtype == 'chain-error'){
    console.log('chain-create/ chain-error');
      method = 'POST';
      url = 'http://211.252.85.59:3000/api/v1/proof/create'; //env.CREATE;
      //url = env.CREATE_DEV; //개발용
  }else{
    method = 'PUT';
    url = 'http://211.252.85.59:3000/api/v1/proof/update'; //env.UPDATE;
    //url = env.UPDATE_DEV;
  }
  let tableName = arg.container+':'+arg.folderIndex;

  function chainuploadCb(error, response, body) {

    if (!error && response.statusCode == 200) {
      log.info('체인코드 업데이트 성공');

      knex(tableName)
        .where({id: arg.fileid})
        .update({chainstatus: 1})  
        .then(()=>{
          //console.log('arg.uploadtype = ',arg.uploadtype);
          mainWindow.webContents.send(arg.uploadtype, {
            error: null,
            body: body,
            index: arg.folderIndex,
          });
        });
      
    }else{
       log.error('chain응답 실패 = ',error, 'info = ',arg); 
       knex(tableName)
        .where({id: arg.fileid})
        .update({uploadstatus: 1, chainstatus: 2})  
        .then(()=>{
          //console.log('arg.uploadtype = ',arg.uploadtype);
          if (mainWindow && !mainWindow.isDestroyed()){
            mainWindow.webContents.send(arg.uploadtype, {error: "chain-error", body:body});
          }
        });

    }
  }
  

  //console.log('reqestProm 호출 method = ',method);
  var options = {  
    method: method,
    uri: url, 
    headers:{
        'Content-Type': 'application/json',
        'X-Auth-Token': arg.token
    },
    body:{
      'id': arg.container , 
      'file': arg.filename   
    },
    json: true    //이거 꼭 필요함. 안그러면 body argument error발생
  };


  reqestProm(options, chainuploadCb)

 }
/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  FILE을 KT 스토리지에 저장하고 db에 기록
 *  KT Storage 서버에 사용자 키를 가져오고 저장한다. promise로 구현
 *  container명은 로그인시 id로...
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
 var fileupload = function (arg){
  
  //const STORAGE_URL = env.STORAGE_URL;
  let startTime = new Date().getTime();
  let tableName = arg.container+':'+arg.folderIndex;

  //kimcy error kt에서 응답이 null이 나와서 수정
  function fileuploadCb(error, response, body) {
    //log.debug('fileuploadCb => error : ',error);
    //log.debug('fileuploadCb => response : ',response);

    //if ( !error && response.statusCode == 201) {
    if(!error && (response != null || response != undefined)){
     if(response.statusCode == 201){
        console.log('업로드 성공');
        //console.log('tablename = ', tableName);
        //console.log('data_backup = ', typeof arg.data_backup);
        var bkzip = arg.data_backup;
        console.log('bkzip = ', bkzip);
        if(bkzip != 'not-store'){
          localStorage.setItem('data_backup',bkzip).then(()=>{
            //console.log('zip저장');
          });
        }


        knex(tableName)
        .where({id: arg.fileid})
        .update('uploadstatus', 1)
        .then(()=>{
          if(mainWindow && !mainWindow.isDestroyed()){
            //console.log('업로드후 db쓰기 완료 다음파일 주세요');
            mainWindow.webContents.send(arg.uploadtype, {
              error: null,
              body: body,
              index: arg.folderIndex,
              startTime: startTime,
              endTime: new Date().getTime(),
            // data_backup: arg.data_backup
            });
          }
        }).catch(function(error){
          log.error('knex 에러 = ',error);
        });
     }else{
      log.error('11..업로드 실패, error = ',error, 'status = ', response.statusCode, 'info = ',arg);
      if (mainWindow && !mainWindow.isDestroyed()){
        mainWindow.webContents.send(arg.uploadtype, {error: response.statusCode});
      }
     }
      
    }else{
      log.error('22..업로드 실패, error = ',error, 'info = ',arg);
      if (mainWindow && !mainWindow.isDestroyed()){
        mainWindow.webContents.send(arg.uploadtype, {error: "000"});
      }
    }
  }


  var options = {  
    method: 'PUT',
    uri: STORAGE_URL+'/'+arg.container+'/'+ encodeURI(arg.filename), 
    //uri: env.STORAGE_URL+'/'+arg.container+'/'+ encodeURIComponent(arg.filename), 
    headers:{
        'X-Auth-Token': arg.token,
        'X-Object-Meta-ctime': startTime
    }
  };

  try{
    var upload = fs.createReadStream(arg.filepath,{highWaterMark : 256*1024});
    var r = reqestProm(options, fileuploadCb);
    upload.pipe(r);
  }catch(err){
    log.error('업로드 에러 : ',err);
  }
  // var upload = fs.createReadStream(arg.filepath,{highWaterMark : 256*1024});
  //   var r = reqestProm(options, fileuploadCb);
    
  //   console.log('11..업로드 시작');
  //   upload.pipe(r).catch(function(err){
  //     log.error('업로드 에러 : ',err);
  //   });
 }


function handleSquirrelEvent(application) {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require("child_process");
  const path = require("path");

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function (command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {
        detached: true
      });
    } catch (error) {
    }

    return spawnedProcess;
  };

  const spawnUpdate = function (args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(application.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(application.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      application.quit();
      return true;
  }
};

