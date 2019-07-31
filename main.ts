import { isFormattedError } from "@angular/compiler";
import {environment} from './src/environments/environment';
//import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';
//import {M5MemberService} from './src/app/services/m5/m5.member.service';
//import {Component, Inject, OnInit} from '@angular/core';

// constructor(
//   @Inject(LOCAL_STORAGE) private storageService: StorageService) {
// }


const {app, BrowserWindow, ipcMain} = require("electron");
const fs = require("fs");
const url = require("url");
const os = require("os");

const path = require("path");

/* original code
import { app, BrowserWindow, ipcMain} from 'electron';
import * as fs from 'fs';
import * as url from 'url';
import * as os from 'os'; 

import * as path from 'path';
*/

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


let isQuiting = false;


if (handleSquirrelEvent(app)) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  app.exit(0); //return;
}
let mainWindow;


var drBackupAutoLauncher = new AutoLaunch({
  name: 'safebackup'
});
drBackupAutoLauncher.enable();


function logger(level, text) {
  log.warn(level, text);
}


/* 글로벌로 해야  garbage colllection이 안된다고함 */
let tray = null;
let contextMenu = null;

function createWindow() {

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
   /*
    mainWindow = new BrowserWindow({
     width: 1000,
     height: 600,
     //"node-integration": "iframe", // and this line
     //"web-preferences": {
     // "web-security": false
     //},
     autoHideMenuBar: true
   });
  */

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
     return true;//process.mainModule.filename.indexOf('app.asar') === -1;
   };
 
   // The following is optional and will open the DevTools:
   if (isDev()) {
     mainWindow.webContents.openDevTools();
   } else {
     //kimcy: 3초후에 사라지게 되서 막음
    //  setTimeout(function () {
    //    mainWindow.minimize();
    //    log.warn('MINIMIZE');
    //  }, 3000);
 
   }
 
   app.on('before-quit', function (e) {
     // Handle menu-item or keyboard shortcut quit here
     if (isQuiting == true) {
       log.warn('CLOSING===>QUIT', isQuiting);
       isQuiting = false;
     } else {
       log.warn('CLOSING==>HIDE', isQuiting);
       e.preventDefault();
       mainWindow.hide();
     }
   });
 
   mainWindow.on('close', function (e) {
     log.warn('CLOSING?', isQuiting);
     if (isQuiting == true) {
       log.warn('CLOSING?-->QUIT', isQuiting);
       isQuiting = false;
       return true;
     } else {
       log.warn('CLOSING?-->HIDE', isQuiting);
       mainWindow.hide();
       e.preventDefault();
       return false;
     }
   });
 
   mainWindow.onbeforeunload = function (e) {
    alert("본 프로그램은 종료가 불가능합니다.")
    e.preventDefault();
    return false;
   };
 
 
   /*---------------------------------------------------------------
            Updater
    ----------------------------------------------------------------*/
   try {
     updater.init({
       url: 'http://version.doctorkeeper.com/safe4.json',
       autoDownload: false,
       checkUpdateOnStart: true,
       logger: {
         info(text) {
           logger('info', text);
         },
         warn(text) {
           logger('warn', text);
         }
       }
     });
 
 
     log.warn('AUTOUPDATE initialized');
     updater.on('update-available', meta => {
       log.warn('[updater] update available', meta.version);
       updater.downloadUpdate()
     });
 
 
     updater.on('update-downloading', (e) => {
       log.warn('downloading', e)
     });
 
     updater.on('update-downloaded', () => {
       isQuiting = true;
       updater.quitAndInstall();
       setTimeout(() => {
         app.relaunch();
         app.exit(0);
       }, 3 * 60 * 1000);
     });
 
     updater.on('update-not-available', (e) => {
       log.warn('there is no available update', e)
     });
     updater.on('error', err => {
       log.warn(err)
     });
 
 
     setInterval(function () {
       updater.checkForUpdates();
       log.warn('CHECKED VERSION');
     }, 60 * 60 * 1000);
 
     updater.checkForUpdates();
   } catch (e) {
     log.warn(e);
   }

}

try {

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow);

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      log.warn('CLOSING????', isQuiting);
      if (isQuiting == true) {
        isQuiting = false;
      } else {
        mainWindow.hide();
        isQuiting = false;
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
 *  IPC : GET FILES
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

 ipcMain.on("GETFOLDERTREE", (event, arg) => {
  //console.log('22..앱이실행중이라 업로드');
  console.log('GETFOLDERTREE', arg);
  console.log('받음, GETFOLDERTREE, main');
  if (arg.path == null) {
    console.log('arg.path == null');
    return;
  }
  diretoryTreeToObj(arg.path, function (err, res) {
      console.log(res);
      if (err) {
        console.error(err);
      } else {
        console.log('33..앱이실행중이라 업로드 res : ',res);
        console.log('보냄, GETFOLDERTREE, main');
        mainWindow.webContents.send("GETFOLDERTREE", {
          folderIndex: arg.folderIndex,
          tree: res
        });
      }
    }
  );
});


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  디렉토리 구조를 JSON으로 변환
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/


var diretoryTreeToObj = function (dir, done) {
  console.log('main,  diretoryTreeToObj dir = ',dir, done);
  var results = [];

//   fs.readdirSync(dir).forEach(function (name) {
//     var filePath = path.join(dir, name);
//     var stat = fs.statSync(filePath);
//     if (stat.isFile()) {
//        // callback(filePath, stat);
//        results.push({  //파일의 속성을 만든다.
//               type: 'file',

//               filename: path.basename(file),
//               fullpath: file,

//               size: stat.size,
//               accessed: stat.atime, //파일에 접근한 마지막 시간
//               updated: stat.mtime, //파일이 수정된 마지막 시간
//               created: stat.ctime, //파일상태가 변경된 마지막시간
//           });
//     } else if (stat.isDirectory()) {
//       diretoryTreeToObj(filePath, res);
//     }
// });
//kimcy: test
  fs.readdir(dir, function (err, list) {
 // fs.readdirSync(dir, function (err, list) {
    if (err)
      return done(err);

    var pending = list.length;
    console.log('diretoryTreeToObj => list.length = ',list.length);
    console.log('diretoryTreeToObj => pending = ',pending);

    if (!pending)
      return done(null, {name: path.basename(dir), type: 'folder', children: results});

    list.forEach(function (file) {
      file = path.resolve(dir, file);
      fs.stat(file, function (err, stat) {
        if (stat) {
          if (stat.isDirectory()) {
            diretoryTreeToObj(file, function (err, res) {
              results.push({  //폴더의 속성을 만든다
                type: 'folder',

                filename: path.basename(file),
                fullpath: file,

                size: stat.size,
                accessed: stat.atime,
                updated: stat.mtime,
                created: stat.ctime,
                children: res
              });
              if (!--pending) {
                done(null, results);
              }
            });
          } else {
            results.push({  //파일의 속성을 만든다.
              type: 'file',

              filename: path.basename(file),
              fullpath: file,

              size: stat.size,
              accessed: stat.atime, //파일에 접근한 마지막 시간
              updated: stat.mtime, //파일이 수정된 마지막 시간
              created: stat.ctime, //파일상태가 변경된 마지막시간
            });
            if (!--pending)
              done(null, results);
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

  console.log(maps);
  const cpus = os.cpus();


  const path = os.platform() === 'win32' ? 'C:/' : '/';

  checkDiskSpace(path).then((diskSpace) => {
    console.log('보냄 main, PCRESOURCE');
    mainWindow.webContents.send("PCRESOURCE", {
      cpus: cpus,
      disk: diskSpace,
      ipaddresses: maps,
      ipaddress: ipaddress,
      macaddress: macaddress
    });
  });


  // disk.check(path, function (err, info) {
  //
  // });

});


/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  IPC : SELECT A FOLDER
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/


ipcMain.on('SELECTFOLDER', (event, arg) => {
  console.log('받음,main, SELECTFOLDER');
  var directory = dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  console.log('보냄,main, SELECTFOLDER');
  mainWindow.webContents.send("SELECTFOLDER", {
    error: null,
    folderIndex: arg.folderIndex,
    directory: directory
  });

});

/*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
 *  FILE을 M5에 전송
 *  KT Storage 서버에 사용자 키를 가져오고 저장한다. promise로 구현
 *  container명은 로그인시 id로...
 -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  var sendFile = function (index, formData, file, accessToken, containerName) {

  const STORAGE_URL = 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3';
 // console.log("fullpath:", file.fullpath);
  let paths = path.dirname(file.fullpath).split(path.sep);


  let startTime = new Date().getTime();
  formData.count = file.size;
  formData.userData = JSON.stringify(formData.userData);

  //console.log("formData:", formData);
  // console.log("file:", file.fullpath);
  // console.log("encodeURIComponent(file.fullpath):", encodeURIComponent(file.fullpath));
  // console.log("encodeURI(file.fullpath):", encodeURI(file.fullpath));
  // console.log("encodeURIComponent(file.fullpath):", encodeURIComponent(STORAGE_URL+'/'+containerName+'/'+ file.fullpath));
  // console.log("encodeURI(file.fullpath):", encodeURI(STORAGE_URL+'/'+containerName+'/'+ file.fullpath));

  //console.log("main, json:", JSON.stringify(file.fullpath));
 // console.log("11..containerName :",containerName);
 

 

  function cbUpload(error, response, body) {
   // console.log(response);
    if (!error && response.statusCode == 201) {
      console.log('cbUpload file successfully');
      console.log('보냄, main, SENDFILE index = ',index);
      mainWindow.webContents.send("SENDFILE", {
          error: null,
          body: body,
          index: index,
          startTime: startTime,
          endTime: new Date().getTime()
        });
    }else{
         console.log('cbUpload file error!!!');
         console.log('보냄, main, SENDFILE ');
         mainWindow.webContents.send("SENDFILE", {error: error});
  
    }
  }
  
  if(formData.subtype === 'file'){
    var options = {  
      method: 'PUT',
      //uri: STORAGE_URL+'/'+containerName+'/'+ file.fullpath, //encodeURI(encodeURIComponent(file.fullpath)),
      uri: STORAGE_URL+'/'+containerName+'/'+ encodeURI(file.fullpath.replace(/\\/g, '/')), //encodeURI(encodeURIComponent(file.fullpath)),
      headers:{
          'X-Auth-Token': accessToken,
          'X-Object-Meta-ctime': startTime
      }
    };
    var upload = fs.createReadStream(file.fullpath,{highWaterMark : 256*1024});
    var r = reqestProm(options, cbUpload);
    
    console.log('업로드 시작');
    upload.pipe(r);
  }

  //kimcy: mac에서는 STORAGE_URL+'/'+containerName+'/'+ encodeURI(file.fullpath)하면 한글도 되나 WINDOW에서는 안됨
  





  // if (formData.subtype == 'file') {
  //   formData['attachments[]'] = encodeURIComponent(JSON.stringify(
  //     {
  //       fileName: file.filename,
  //       fileType: file.type,
  //       fileSize: file.size,
  //       fullpath: file.fullpath,
  //       parentPath: formData.userData.parentPath
  //     }));
  // }

  //  console.log("file:", file);
  // if (file.type == 'file') {
  //   formData['files[]'] = [fs.createReadStream(file.fullpath)];
  // }

  // var r = request({
  //       method: 'POST',
  //       uri: url,
  //       json: true,
  //       timeout: 0,
  //       headers: {
  //         'X-Madamfive-APIKey': apiKey
  //       },
  //       formData: formData
  //     },
  //     function (error, response, body) {
  //       // if (q != null) {
  //       //   clearInterval(q);
  //       // }
  //       if (error != null) {
  //         console.log('ERROR', error);
  //         mainWindow.webContents.send("SENDFILE", {error: error});
  //       } else {
  //         console.log('SUCCESS', index);
  //         mainWindow.webContents.send("SENDFILE", {
  //           error: null,
  //           body: body,
  //           index: index,
  //           startTime: startTime,
  //           endTime: new Date().getTime()
  //         });
  //         console.log('SUCCESS', response);
  //       }
  //     }
  //   );
  
  
  //   try {
  //     var q = setInterval(function () {
  //       if (r.req == null || r.req.connection == null) {
  //         return;
  //       }
  //       var dispatched = r.req.connection._bytesDispatched;
  //       let percent = dispatched * 100 / file.size;
  //       /* TODO : ??? */
  //       if (percent >= 100) {
  //         percent = 100;
  //       }
  //       console.dir("Uploaded: " + percent + "%");
  //       mainWindow.webContents.send("SENDING.PROGRESS", {percent: percent});
  //     }, 250);
  //   } catch (e) {
  //     console.log(e);
  //   }

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

