const { execSync } = require("child_process");
const fs = require('fs');
const _7z = require('7zip-min');

// process.chdir("./");
const testPath = 'C:\\NEO-BACKUP'
const backupFolder = "C:\\datakeeperBackupZip";
let birdpath = "C:\\bird_datasets";
let birdZip = "C:\\7zip-test\\packed\\bird.7z";


let basePath = "C:\\7zip-test\\miniSample";
let baseZip = backupFolder + "\\base.7z";
let diffZip = backupFolder + "\\diff" + getToday() + ".7z";
let recoveryPath = "C:\\heal\\"


// let cmdPack = "7za a -t7z " + baseZip + " " + basePath;

let cmdPack = "7za a -t7z " + baseZip + " " + basePath;
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
        console.log("exist diff 7z");
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


// mkdirSync backupFolder
// if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder,'0777', true);




// // Read file stats
// fs.stat(birdpath, (err, stats) => {
//     if (err) {
//         console.log(err);
//     } else {
//         let zipSize = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
//         console.log(zipSize + "GB");
//         console.log("testPath : " + testPath)
//         console.log(stats)
//     }
// });



let str = 'base-jy20220208.7z'
const buFolder = "C:\\datakeeperBackupZip";
let checkBase = buFolder + "\\" + "base-"


// console.log(buFolder);
// console.log(buFolder + "\\base-jy20220208.7z");

// fs.readdir(buFolder, (err, file_list) => { 
//     console.log(file_list) 
// });

// console.log(fs.existsSync(buFolder + "\\base-jy20220208.7z"));

// if (!fs.existsSync(fs.existsSync(buFolder + "\\" + "diff-" + getToday() + "jy.7z"))) {
//     console.log("diff go")
// }



//   let base7z = buFolder + "\\" + "base.7z";
//   let diff7z = buFolder + "\\" + "diff" + getToday() + ".7z";

//   console.log(base7z);
//   console.log(diff7z);
//   if (!fs.existsSync(diff7z) && fs.existsSync(base7z)) {
//     console.log("diff here")
//   }



// // 파일 삭제
// try{
//     let files = fs.readdirSync(backupFolder);
    
//     for(let i in files) {
//       if(files[i].toLowerCase().lastIndexOf('.7z')>0 && files[i].startsWith('diff')){
//         console.log(backupFolder +'\\'+files[i]);
//         let fileCtime = files[i].substr(4,8);
//         // console.log(fileCtime)
//         // console.log(getToday() > fileCtime);
//         if(getToday() > fileCtime) {
//             // fs.unlinkSync(backupFolder +'/'+files[i]);
//         }
//       }
//     }
//   }catch(err){
//     console.error('실패', err);
//   }




// 분할압축 : 7za a {압축파일만들 경로} {압축 대상 경로} 분할 사이즈
// zipperSeven(" 7za a -t7z C:\\7zip-test\\packed\\diff" + getToday() + ".7z C:\\7zip-test\\packed\\ -v1g");


// 분할 해제
// zipperSeven("7z x C:\\7zip-test\\packed\\bi.7z.001");


