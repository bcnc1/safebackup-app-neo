import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {MainPageComponent} from './main-page.component';
import {MainPageRoutingModule} from './main-page-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    MainPageRoutingModule
  ],
  declarations: [MainPageComponent],
  exports: [
    MainPageComponent
  ]
})
export class MainPageModule { }
