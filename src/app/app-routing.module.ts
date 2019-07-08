import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import {NeedAuthGuard} from './auth.guard';

import {LoginPageComponent} from './pages/login/login-page.component';
import {MainPageComponent} from './pages/main/main-page.component';
import {HomePageComponent} from './pages/home/home-page.component';
import {SignupPageComponent} from './pages/login/signup-page.component';

const routes: Routes = [
  {
    path: '',
    component: MainPageComponent
  },
  {
    path: 'home',
    component: HomePageComponent,
    canActivate: [NeedAuthGuard]
  },
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: 'signup',
    component: SignupPageComponent
  },

];

@NgModule({
    imports: [
        RouterModule.forRoot(routes),
    ],
    exports: [RouterModule],
    providers: [
        NeedAuthGuard
    ],
})
export class AppRoutingModule { }
