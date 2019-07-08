import {BrowserModule} from '@angular/platform-browser';

import {NgxElectronModule} from 'ngx-electron';
import {AngularFontAwesomeModule} from 'angular-font-awesome';
import {LoggerModule, NgxLoggerLevel} from 'ngx-logger';


import {CUSTOM_ELEMENTS_SCHEMA, NgModule} from '@angular/core';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';

import {HttpAuthInterceptor} from './http.auth.interceptor';
import {HttpClientModule, HTTP_INTERCEPTORS} from '@angular/common/http';


import {HomePageModule} from './pages/home/home-page.module';
import {LoginPageModule} from './pages/login/login-page.module';
import {MainPageModule} from './pages/main/main-page.module';


import {UploadFiletreeService} from './services/upload.filetree.service';
import {AlertPopupComponent} from './components/alert-popup.component';
import {KonsoleService} from './services/konsole.service';

declare var require: any;


@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    NgxElectronModule,
    LoggerModule.forRoot({
      level: NgxLoggerLevel.DEBUG
    }),
    AngularFontAwesomeModule,
    MainPageModule,
    HomePageModule,
    LoginPageModule,
  ],
  declarations: [
    AlertPopupComponent,
    AppComponent,

  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpAuthInterceptor,
      multi: true
    },

    KonsoleService,
    UploadFiletreeService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]

})

export class AppModule {
}
