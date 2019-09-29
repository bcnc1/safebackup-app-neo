// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `index.ts`, but if you do
// `ng build --env=prod` then `index.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.



export const environment = {
  production: false,
  VERSION: require('../../package.json').version,
  // M5SERVER: 'http://localhost:7919',
  M5SERVER: 'http://sb.doctorkeeper.com',
  M5APIKEY: 'd2todG9udllCWmFoYTBEQ3dkUW1rUHpOVXY5STFIcVFOWUxxUkdoQXEyWT0K.GDIrECy2hnoskBSo5+xz1RBbX6pA1Q/4UuZqhm6sV8s=',
  //KT Storage
  STORAGE_URL : 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3',
  AUTH_URL :'https://ssproxy.ucloudbiz.olleh.com/auth/v1.0',
  CREATE : 'http://211.252.85.59:3000/api/v1/proof/create',
  UPDATE : 'http://211.252.85.59:3000/api/v1/proof/update'

};