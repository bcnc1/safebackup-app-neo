import {throwError} from 'rxjs';
import {ObjectUtils} from '../../utils/ObjectUtils';
import {environment} from '../../../environments/environment';


export class M5Service {
  static apiKey = environment.M5APIKEY;
  static server = environment.M5SERVER;
  //kimcy
  static s3Storage = 'https://ssproxy.ucloudbiz.olleh.com/v1/AUTH_10b1107b-ce24-4cb4-a066-f46c53b474a3'; //environment.STORAGE_URL;
  static s3Auth = 'https://ssproxy.ucloudbiz.olleh.com/auth/v1.0'; 
  static apiServer = 'http://211.252.85.59:3000/api';
  static login = M5Service.apiServer +'/v1/user/login';
  static create = M5Service.apiServer +'/v1/proof/create';

  // static server = 'http://192.168.0.197:7919';

  url = {
    //kimcy
    login: function () {
      console.log('m5.member, login');
      return M5Service.apiServer +'/v1/user/login';
    },
    signup: function () {
      console.log('m5.member, signup');
      return M5Service.server + '/v1/register/email';
    },
    posts: function (postId) {
      console.log('m5.member, posts');
      if (ObjectUtils.isEmpty(postId)) {
        return M5Service.server + '/v1/posts';
      }
      return M5Service.server + '/v1/posts/' + postId;
    },
    boards: function (boardId) {
      console.log('m5.member, boards');
      return M5Service.server + '/v1/boards/' + boardId;
    },
    members: function (memberId) {
      console.log('m5.member, members');
      return M5Service.server + '/v1/members/' + memberId;
    },
    //kimcy
    list: function (username) {
      console.log('m5.member, list');
      return M5Service.s3Storage + '/'+ username;
    },

  };


  constructor() {

  }


  protected handleData(response: any) {
    console.log('handleData');
    console.log(response);
    if (200 !== response.header.code) {
      throw response.header;
    }
  }

  protected handleError(error: Response) {
    console.log('ERROR', error);
    return throwError(error);
  }

  protected getFormUrlEncoded(toConvert) {
    const formBody = [];
    for (const property in toConvert) {
      console.log('m5.service, property',property);
      if (toConvert.hasOwnProperty(property)) {
        const encodedKey = encodeURIComponent(property);
        const encodedValue = encodeURIComponent(toConvert[property]);
        formBody.push(encodedKey + '=' + encodedValue);
      }
    }
    return formBody.join('&');
  }

}



