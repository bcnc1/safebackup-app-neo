import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpResponse} from '@angular/common/http';
import {HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {M5Service} from './services/m5/m5.service';

@Injectable()
export class HttpAuthInterceptor implements HttpInterceptor {




  intercept(req: HttpRequest<any>,
            next: HttpHandler): Observable<HttpEvent<any>> {



    let clonedRequest = req.clone({
      headers: req.headers.set('X-Madamfive-APIKey', M5Service.apiKey)
    });

    clonedRequest = clonedRequest.clone({
      headers: clonedRequest.headers.set('Content-type', 'application/json')
    });


    console.log('REQUEST', clonedRequest.url);
    console.log('HEADERS', clonedRequest.headers);
    return next.handle(clonedRequest).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          console.log('RESPONSE', event.body);
        }
        return event;
      }));
  }
}
