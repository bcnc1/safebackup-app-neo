import {CUSTOM_ELEMENTS_SCHEMA, NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {HomePageComponent} from './home-page.component';
import {HomePageRoutingModule} from './home-page-routing.module';
import {LogComponent} from './log.component';
import { ModalModule } from 'ngx-bootstrap/modal';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { NgPipesModule } from 'angular-pipes';

@NgModule({
  imports: [
    ModalModule.forRoot(),
    TabsModule.forRoot(),
    NgPipesModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    HomePageRoutingModule
  ],
  declarations: [
    LogComponent,
    HomePageComponent
  ],
  providers: [
  ],
  exports: [
    HomePageComponent,
    ModalModule,
    TabsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePageModule {
}
