

export const environment = {
  production: false,
  VERSION: require('../../package.json').version,
  // M5SERVER: 'http://localhost:7919',
  M5SERVER: 'http://sb.doctorkeeper.com',
  M5APIKEY: 'd2todG9udllCWmFoYTBEQ3dkUW1rUHpOVXY5STFIcVFOWUxxUkdoQXEyWT0K.GDIrECy2hnoskBSo5+xz1RBbX6pA1Q/4UuZqhm6sV8s=',
  //KT Storage
  STORAGE_URL : 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3',
  AUTH_URL :'https://ssproxy.ucloudbiz.olleh.com/auth/v1.0',
  //API_SERVER : 'http://211.252.85.59:3000/api',
  CREATE : 'http://211.252.85.59:3000/api/v1/proof/create',
  UPDATE : 'http://211.252.85.59:3000/api/v1/proof/update',

  CREATE_DEV : 'http://localhost:3000/api/v1/proof/create',
  UPDATE_DEV : 'http://localhost:3000/api/v1/proof/update',
  
  API_SERVER : 'http://211.252.85.59:3000/api',

  URGENT_READ : 'http://211.252.85.59:3000/api/v1/notice/urgent/read'
};