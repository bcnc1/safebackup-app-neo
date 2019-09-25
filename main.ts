import { isFormattedError } from "@angular/compiler";
import {environment} from './src/environments/environment';
import { Router } from '@angular/router';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
import { createInjectable } from "@angular/compiler/src/core";
import { userInfo } from "os";

//db작성: https://www.youtube.com/watch?v=c76FTxLRwAw

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
    filename: app.getPath('userData')+'/'+ 'sb.db'
  }
});
var member;

//StorageService.get()
//console.log('knex = ',knex);



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

  //kimcy: memory 를 4g까지 사용
  //app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
 // app.on('ready', createWindow);
 app.on('ready', ()=> {
  console.log('Ready');
  createWindow();
  createSBDatabBase();
 });
}

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
    if (fs.existsSync(app.getPath('userData')+'/'+ 'sb.db')) {
          console.log('exists');
    } else{
      console.log('does not');
      var db = new sqlite3.Database(app.getPath('userData')+'/'+ 'sb.db');
      db.close();
    }


    // knex.schema.createTable('users', function (table) {
    //   table.increments();
    //   table.string('name');
    //  // table.timestamps();
    // }).then(()=>{
    //   console.log('create');
    // });
 }

 function createTable(index, window, callback){
   console.log('createTable');
   localStorage.getItem('member').then((value) => {
      member = JSON.parse(value);
      console.log('createTable, member = ',member);
      var user = member.username;
      var tableName = user+':'+index;

      knex.schema.hasTable(tableName).then(function(exists) {
        if (!exists) {
          knex.schema.createTable(tableName, function(t) {
            t.increments('id').primary();
            t.text('filename');
            t.string('property');  //data_bakup, npki
            t.integer('filesize');
            t.string('fileupdate');
            t.boolean('upload');
            t.boolean('chain');
          }).then(()=>{
            callback(true);
          }).catch(()=>{
            callback(false);
          });
        }else{
          return true;
        }
      });
   });
 
   

   

  //  knex.schema.createTable('users', function (table) {
  //     table.increments();
  //     table.string('name');
  //    // table.timestamps();
  //   }).then(()=>{
  //     console.log('create');
  //   });
 }

 function addDB(member, arg){
  console.log('addDB');
  var tableName = member.username+':'+arg.folderIndex;

  const watcher = chokidar.watch(arg.path, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  //const log = console.log.bind(console);

  if(mainWindow && !mainWindow.isDestroyed()){
    watcher
    .on('add', function(path, stats) { 
      
      console.log('File', path, 'has been added'); 
      //console.log('22.. tableName = ', tableName, 'has been added'); 
      knex.schema.hasTable(tableName).then(function(exists){
        if(exists){
          console.log('path = ',path);
          knex(tableName).where('filename', path).then((results)=>{
            if(results.length == 0 ){
              //console.log('22..일치하는 값 없음');
              knex(tableName).insert({filename: path, filesize : stats.size}).then(()=>{
               console.log('일차하는 값 없어서 insert');
              });
            } else{
              console.log('파일이름이 존재, 따라서 사이즈 비교, stats = ', stats.size);
              console.log('stats 타입 = ', typeof stats.size);
              knex(tableName).where({
                filename: path,
                filesize: stats.size
              }).select('id').then((results)=>{
                console.log('results = ',results);
                if(results.length == 0){
                  console.log('새로운 값임으로 insert');
                  knex(tableName).insert({filename: path, filesize : stats.size}).then(()=>{
                    console.log('11..일차하는 값 없어서 insert');
                   });
                }else{
                  console.log('db에 저장된 값임으로 skip');
                }
              });
            }
          });

        }else{
          console.log('테이블 없음');
        }
      });
    })
   
    .on('ready', function() 
    { 
      console.log('Initial scan complete. Ready for changes.');
   
  
    })
  }
}
/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : GET FILES
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

 ipcMain.on("GETFOLDERTREE", (event, arg) => {
  
  console.log('받음, GETFOLDERTREE, main');
  if (arg.path == null) {
    console.log('arg.path == null');
    return;
  }

  //chokdir 프로그램으로 파일을 읽어서 db에 넣을려고 했으나 그럴 필요가 없을 듯 하여 막음
  // console.log('member = ', member);
  // if(member === undefined){
  //   localStorage.getItem('member').then((value) => {
  //     member = JSON.parse(value);
  //     console.log('111.. member = ',member);
  //     addDB(member, arg);
  //   });
  // } else{
  //   console.log('22.. member = ',member);
  //   addDB(member, arg);
  // }
  
  diretoryTreeToObj(arg.path, function (err, res) {
      if (err) {
      //  console.error(err);
      } else {
        if(mainWindow && !mainWindow.isDestroyed()){
          console.log('보냄, GETFOLDERTREE, main');
          mainWindow.webContents.send("GETFOLDERTREE", {
            folderIndex: arg.folderIndex,
            tree: res
          });
        }
      }
    }
  );
  

  


  // Returns [2] in "mysql", "sqlite"; [2, 3] in "postgresql"
// knex.insert([{title: 'Great Gatsby'}, {title: 'Fahrenheit 451'}], ['id']).into('books')
// Outputs:
// insert into `books` (`title`) values ('Great Gatsby'), ('Fahrenheit 451')

// knex('users').where({
//   first_name: 'Test',
//   last_name:  'User'
// }).select('id')
// Outputs:
// select `id` from `users` where `first_name` = 'Test' and `last_name` = 'User'

  
  
});


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  디렉토리 구조를 JSON으로 변환
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/


var diretoryTreeToObj = function (dir, done) {
  console.log('main,  diretoryTreeToObj dir = ',dir, done);
  var results = [];

  fs.readdir(dir, function (err, list) {  //비동기 함수, dir: 주어진 디렉토리
    if (err)
      return done(err);

    var pending = list.length;
     console.log('diretoryTreeToObj => list = ',list);
     console.log('pending = ',pending);

    //kimcy
    if(dir.lastIndexOf('NPKI')!= -1){
      console.log('NPKI폴더')
      return done(null, {name: dir, type: 'folder', children: results});
    }

    if (!pending){
      console.log('33, pending = ', pending, 'dir = ',dir);
      return done(null, {name: path.basename(dir), type: 'folder', children: results});
    }
      

    list.forEach(function (file) {
      console.log('main, 11.. file = ',file);
      file = path.resolve(dir, file); //fullpath만들어주기
      console.log('main, 22.. file = ',file);
      fs.stat(file, function (err, stat) {
        if (stat) {
          if (stat.isDirectory()) {
            diretoryTreeToObj(file, function (err, res) {
              console.log('폴더넣기 file = ,',file,' pending = ',pending);
              results.push({  //폴더의 속성을 만든다
                type: 'folder',

                filename: path.basename(file),
                fullpath: file,

                size: stat.size,
                // accessed: stat.atime,
                // updated: stat.mtime,
                // created: stat.ctime,
                children: res
              });
              if (!--pending) {
                console.log('11 done = ', results,'pending = ',pending);
                done(null, results);
              }
            });
          } else {
            console.log('파일넣기 file =',file, 'pending = ',pending);
            results.push({  //파일의 속성을 만든다.
              type: 'file',

              filename: path.basename(file),
              fullpath: file,

              size: stat.size,
              // accessed: stat.atime, //파일에 접근한 마지막 시간
              // updated: stat.mtime, //파일이 수정된 마지막 시간
              // created: stat.ctime, //파일상태가 변경된 마지막시간
            });
            if (!--pending){
              console.log('22 done = ', results, 'pending = ',pending);
              done(null, results);
            }
              
          }
        }
      });
    });
  });
};


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SEND FILE
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/


ipcMain.on("SENDFILE", (event, arg) => {
  console.log('받음, main, SENDFILE => token:', arg.accessToken);
  try {
    sendFile(arg.index, arg.formData, arg.file, arg.accessToken, arg.username);
  } catch (e) {
    console.log(e);
  }
});


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

  var maps = Object.keys(interfaces)
    .map(x => interfaces[x].filter(x => x.family === 'IPv4' && !x.internal)[0])
    .filter(x => x);

  let ipaddress = null;
  let macaddress = null;


  if(maps != null) {
    ipaddress = maps[0].address;
    macaddress = maps[0].mac;
  }


    //db table 생성
    //createTable(macaddress)

  const cpus = os.cpus();


  const path = os.platform() === 'win32' ? 'C:/' : '/';

  checkDiskSpace(path).then((diskSpace) => {
    
    if(mainWindow && !mainWindow.isDestroyed()){
      console.log('보냄 main, PCRESOURCE');
      mainWindow.webContents.send("PCRESOURCE", {
        cpus: cpus,
        disk: diskSpace,
        ipaddresses: maps,
        ipaddress: ipaddress,
        macaddress: macaddress
      });
    }

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
 
  if(mainWindow && !mainWindow.isDestroyed()){
    
    //db생성
    //db table 생성
    createTable(arg.folderIndex, mainWindow,(result) => {
      console.log('보냄,main, SELECTFOLDER');
      console.log('result = ',result);
      if(result){
        mainWindow.webContents.send("SELECTFOLDER", {
          error: null,
          folderIndex: arg.folderIndex,
          directory: directory
        });
      }else{
        log.warn('데이터베이스 생성 실패');
      }
      
    });

    // console.log('보냄,main, SELECTFOLDER');
    // mainWindow.webContents.send("SELECTFOLDER", {
    //   error: null,
    //   folderIndex: arg.folderIndex,
    //   directory: directory
    // });
  }


});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  FILE을 M5에 전송
 *  KT Storage 서버에 사용자 키를 가져오고 저장한다. promise로 구현
 *  container명은 로그인시 id로...
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  var sendFile = function (index, formData, file, accessToken, containerName) {

  const STORAGE_URL = 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3';
  console.log("fullpath:", file.fullpath);
  let paths = path.dirname(file.fullpath).split(path.sep);
  console.log("paths:", paths);
  console.log("파일명:", file.filename);

  let startTime = new Date().getTime();
  formData.count = file.size;
  formData.userData = JSON.stringify(formData.userData);


  function cbUpload(error, response, body) {
   // console.log(response);
    if (!error && response.statusCode == 201) {
      console.log('업로드 성공, 보냄, main, SENDFILE ');
      if(mainWindow && !mainWindow.isDestroyed()){
        mainWindow.webContents.send("SENDFILE", {
          error: null,
          body: body,
          index: index,
          startTime: startTime,
          uploadPath: encodeURI(formData.code.replace(/\\/g, '/')),
          endTime: new Date().getTime(),
          chain: formData.chain
        });
      }

    }else{
         console.log('업로드 실패, 보냄, main, SENDFILE  ');
         if (mainWindow && !mainWindow.isDestroyed()){
          mainWindow.webContents.send("SENDFILE", {error: error});
         }
    }
  }
  
  if(formData.subtype === 'file'){
    var options = {  
      method: 'PUT',
      uri: STORAGE_URL+'/'+containerName+'/'+ encodeURI(formData.code.replace(/\\/g, '/')), 
      headers:{
          'X-Auth-Token': accessToken,
          'X-Object-Meta-ctime': startTime
      }
    };
    var upload = fs.createReadStream(file.fullpath,{highWaterMark : 256*1024});
    var r = reqestProm(options, cbUpload);
    
    console.log('업로드 시작');
    upload.pipe(r).catch(function(err){
      console.log('terminate22');
    });
  }else{
    if(mainWindow && !mainWindow.isDestroyed()){
      mainWindow.webContents.send("SENDFILE", {
        error: null,
        body: 'folder',
        index: index,
        startTime: startTime,
        endTime: new Date().getTime()
      });
    }
  }
};

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

