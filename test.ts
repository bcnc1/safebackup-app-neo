const { execSync } = require("child_process");
const fs = require('fs');
// process.chdir("./");

const backupFolder = "C:\\datakeeperBackupZip";
let birdpath = "C:\\bird_datasets";
let birdZip = "C:\\7zip-test\\packed\\bird.7z";


let basePath = "C:\\7zip-test\\miniSample";
let baseZip = backupFolder + "\\base.7z";
let diffZip = backupFolder + "\\diff" + getToday() + ".7z";
let recoveryPath = "C:\\heal\\"


// let cmdPack = "7za a -t7z " + baseZip + " " + basePath;

let cmdPack = "7za a -t7z " + birdZip + " " + birdpath;
let cmdDiffPack = "7za u " + baseZip + " " + basePath + " -ms=off -t7z -u- -up0q3r2x2y2z0w2!" + diffZip;
let cmdRecovery = "7za x " + basePath


function getToday(){
    var date = new Date();
    var year = date.getFullYear();
    var month = ("0" + (1 + date.getMonth())).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);

    return year + month + day;
}





function zipperSeven (cmd) {
    console.log(cmd);
    execSync(cmd, (error) => {
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        } 
      });
}


function differentialBackup () {
    if (fs.existsSync(diffZip)) {
        console.log("to be");
    } else {
        zipperSeven (cmdDiffPack);
    }
}

function baseBackup () {
    zipperSeven (cmdPack);
}

baseBackup();
// differentialBackup();


// // recovery : first basebackup unpack, after last diffbackup unpack 2step
// zipperSeven("7za x C:\\7zip-test\\packed\\packed.7z -oc:\\recovery_path\\");
// zipperSeven("7za x C:\\7zip-test\\packed\\diff20220207_2.7z -aoa -y -oc:\\recovery_path\\");

// console.log(cmdDiffPack)
// "7z a -v4.9g seg.7z [files]"




// 분할압축 : 7za a {압축파일만들 경로} {압축 대상 경로} 분할 사이즈
// zipperSeven(" 7za a C:\\7zip-test\\packed\\bi.7z C:\\7zip-test\\packed\\ -v1g");

// 분할 해제
// zipperSeven("7z x C:\\7zip-test\\packed\\bi.7z.001");


//mkdirSync backupFolder
if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder,'0777', true);