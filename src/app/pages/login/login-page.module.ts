import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {LoginPageComponent} from './login-page.component';
import {SignupPageComponent} from './signup-page.component';
import {RouterModule} from '@angular/router';

@NgModule({
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
  ],
  declarations: [LoginPageComponent, SignupPageComponent],
  exports: [
    LoginPageComponent,
    SignupPageComponent
  ]
})
export class LoginPageModule {
}



