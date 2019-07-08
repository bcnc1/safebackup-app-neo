
//1. andmin token을 얻어온다.
const request = require('request-promise-native')
const fs = require('fs');

const authUrl = 'https://ssproxy.ucloudbiz.olleh.com/auth/v1.0';
const regUrl = 'https://ssproxy.ucloudbiz.olleh.com/auth/v2';
const storageUrl = 'get token에서 받을 수 있다. static하게 받아서 사용가능하다.';
const account = 'storage의 account 계정, storage대시보드상의 어드민계정';
const colon = ':';
const admin = 'storage의 admin계정, storage대시보드상의 유저계정';
const adpw = 'admin계정의 패스워드';
const userpw = '등록할 사용자의 패스워드';
const newUser = '등록할 사용자 명';
const containerName = '등록할 container명';


//1. admintoken 얻기  - 서버사이드
let  admToken , userToken;


function getAdmToken(){
	const ad = admToken;
}

//jon형식으로 받기위해서는 json을 true로..
const optGetAdmToken = {
    uri: authUrl,
    headers:{
        'X-Auth-New-Token': 'true',
        'x-storage-user': account+colon+admin,
        'x-storage-pass': adpw
        /*,
        json:true*/
        
    }
}

function cbGetAdmToken(error, response, body) {
  if (!error && response.statusCode == 200) {
     admToken = response.headers['x-auth-token'];
  }
}


//2.리셀러사용자등록
const optRegUser = {
    uri: regUrl+'/'+account+'/'+newUser,
    method: 'PUT',
    headers:{
        'X-Auth-User-Key': userpw,
        'X-Auth-Admin-key': adpw,
        'X-Auth-Admin-User': account+colon+admin
    }
}

function cbRegUser(error, response, body) {
   // console.log(response);
  if (!error && response.statusCode == 201) {
    
    console.log('create user success');

  }else{
       console.log('create user error');
  }
}


//4. contaner를 만든다.
function cbCreateCt(error, response, body) {
  //console.log(response);
  if (!error && response.statusCode == 201) {
    console.log('create container successfully');

  } else if(!error && response.statusCode == 202){
	  console.log('create container already');
  }else{
       console.log('create container error!!!');

  }
}

//5. container 에 사용자 등록 (write권한)
function cbEnrollUser(error, response, body) {
  //console.log(response);
  if (!error && response.statusCode == 204) {
    console.log('enroll container successfully');

  }else{
       console.log('enroll container error!!!');

  }
}

//6. 파일업로드
function cbUpload(error, response, body) {
  console.log(response);
  if (!error && response.statusCode == 201) {
    console.log('cbUpload file successfully');

  }else{
       console.log('cbUpload file error!!!');

  }
}

request(optGetAdmToken,cbGetAdmToken )
    .then(function( ){
    
     console.log('어드민 토큰 얻어옴..')  ;
  
      return request(optRegUser, cbRegUser);
    })
    .then(function (){
        console.log('사용자 등록 완료  어드민 토큰 ', admToken)  ; 
	     var optCreateCt = {
			uri: storageUrl+'/'+containerName,
			method: 'PUT',
			headers:{
				'X-Auth-Token': admToken  
			}
		}
       return request(optCreateCt, cbCreateCt );
    })
    .then (function (){
        console.log('컨테이너 생성 완료')   ;
		var optEnrollUser = {
			uri: storageUrl+'/'+containerName,
			method: 'POST',
			headers:{
				'X-Auth-Token': admToken,
				'x-container-write': account+':'+newUser
			}
		}
	 
	  return request(optEnrollUser, cbEnrollUser, );
    })
	.then (function(){
		//console.log('컨테이너 권한 생성 완료')   ;
	    var optUpload = {
		uri: storageUrl+'/'+containerName+'/'+'doc1.pptx',
		formData:{
			file:{
				value: fs.createReadStream('../../Postman/doc.pptx'),
				options: {
					filename: 'doc1.pptx'
            	}
			}
		},
		method: 'PUT',
			headers:{
				'X-Auth-Token': userToken
			}
		}		
	  return request(optUpload, cbUpload ); 	
	})

    .catch(function (err){
           console.log('error..')     
    });



//3.사용자 토큰을 얻어온다
const optGetUserToken = {
    uri: authUrl,
    headers:{
        'X-Auth-New-Token': 'true',
        'x-storage-user': account+colon+newUser,
        'x-storage-pass': userpw

        
    }
}

function cbGetUserToken(error, response, body) {
  if (!error && response.statusCode == 200) {

    userToken = response.headers['x-auth-token'];
    console.log('사용자토큰:',userToken);

  }
}

request(optGetUserToken, cbGetUserToken);




