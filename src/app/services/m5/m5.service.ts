import {throwError} from 'rxjs';
import {ObjectUtils} from '../../utils/ObjectUtils';
import {environment} from '../../../environments/environment';


export class M5Service {
  static apiKey = environment.M5APIKEY;
  static server = environment.M5SERVER;
  // static server = 'http://localhost:7919';
  // static server = 'http://192.168.0.197:7919';

  url = {
    login: function () {
      return M5Service.server + '/v1/login';
    },
    signup: function () {
      return M5Service.server + '/v1/register/email';
    },
    posts: function (postId) {
      if (ObjectUtils.isEmpty(postId)) {
        return M5Service.server + '/v1/posts';
      }
      return M5Service.server + '/v1/posts/' + postId;
    },
    boards: function (boardId) {
      return M5Service.server + '/v1/boards/' + boardId;
    },
    members: function (memberId) {
      return M5Service.server + '/v1/members/' + memberId;
    }
  };


  constructor() {

  }


  protected handleData(response: any) {
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
      if (toConvert.hasOwnProperty(property)) {
        const encodedKey = encodeURIComponent(property);
        const encodedValue = encodeURIComponent(toConvert[property]);
        formBody.push(encodedKey + '=' + encodedValue);
      }
    }
    return formBody.join('&');
  }

}



