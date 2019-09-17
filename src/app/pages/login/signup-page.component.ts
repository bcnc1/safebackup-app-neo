import {Component, Inject, OnInit} from '@angular/core';
import {M5MemberService} from '../../services/m5/m5.member.service';
import {Router} from '@angular/router';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {LOCAL_STORAGE, StorageService} from 'ngx-webstorage-service';

@Component({
  selector: 'app-signup-page',
  templateUrl: './signup-page.component.html',
  styleUrls: ['./signup-page.component.scss']
})


export class SignupPageComponent implements OnInit {

  constructor(
    private formBuilder: FormBuilder,
    private memberAPI: M5MemberService,
    @Inject(LOCAL_STORAGE) private storage: StorageService,
    private router: Router
  ) {
  }


  registerForm: FormGroup;
  public f;
  public submitted;
  public loading = false;




  ngOnInit() {
    console.log("ngOnInit :");
    this.registerForm = this.formBuilder.group({
      fullname: ['', Validators.required],
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }


  onSubmit() {
    console.log('signup-page => onSubmit');
    // this.memberAPI.signup(this.registerForm.value).subscribe(
    //   response => {
    //     {
    //       console.log("signup :", response);
    //       //kimcy
    //      // this.storage.set('username', this.registerForm.value.username);
    //       this.storage.set('password', this.registerForm.value.password);
    //       this.router.navigateByUrl('/home');
    //     }
    //   },
    //   error => {
    //     if (error.code != null) {
    //       alert(error.message);
    //     } else {
    //       alert(error);
    //     }
    //   });
  }
}
