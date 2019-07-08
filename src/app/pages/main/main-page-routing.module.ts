import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';


import {MainPageComponent} from './main-page.component';

const routes: Routes = [
  {
    path: 'home',
    component: MainPageComponent,
    children: [
      {
        path: 'detail',
        component: MainPageComponent
      }
    ]
  }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainPageRoutingModule { }
