import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';

@Component({
  selector: 'app-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss']
})


export class MainPageComponent implements  OnInit{
  constructor(private router: Router) {
  }

  onLogin() {
    this.router.navigateByUrl('/login');
  }

  ngOnInit() {
    this.router.navigateByUrl('/login');
  }
}
