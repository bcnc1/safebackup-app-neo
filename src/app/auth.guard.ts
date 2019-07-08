import {CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {Injectable} from '@angular/core';
import {M5MemberService} from './services/m5/m5.member.service';
import {ObjectUtils} from './utils/ObjectUtils';

@Injectable()
export class NeedAuthGuard implements CanActivate {

  constructor(private m5MemberService: M5MemberService, private router: Router) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {

    if (this.m5MemberService.isLoggedin()!=null) {
      console.log('LOGIN??');
      return true;
    }

    // not logged in so redirect to login page with the return url
    this.router.navigate(['/login'], {queryParams: {returnUrl: state.url}});
    return false;
  }
}


