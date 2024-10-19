import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { MdbTabComponent } from 'mdb-angular-ui-kit/tabs';
import { LoginDataService } from './login.service';
import { LoginUser } from './login.schema';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('tab', { static: true }) tab!: MdbTabComponent | any;
  textMode: string = "password";

  signInForm: FormGroup<any> = new FormGroup({
    loginName: new FormControl("", [Validators.required, Validators.minLength(2)]),
    loginPassword: new FormControl("", [Validators.required, Validators.minLength(5)]),
  });

  registerForm: FormGroup<any> = new FormGroup({
    registerName: new FormControl("", [
      Validators.required,
      Validators.min(5),
    ]),
    registerUsername: new FormControl("", [
      Validators.required,
      Validators.min(2),
    ]),
    registerEmail: new FormControl("", [
      Validators.required,
      Validators.min(2),
    ]),
    registerPassword: new FormControl("", [
      Validators.required,
      Validators.min(5),
    ]),
    registerRepeatPassword: new FormControl("", [
      Validators.required,
      Validators.min(5),
    ]),
    registerCheck: new FormControl("", [
      Validators.required
    ]),
    
  });

  signUpFormArray: FormArray = new FormArray([this.registerForm]);
  signInFormArray: FormArray = new FormArray([this.signInForm]);


  constructor(private loginDataService: LoginDataService) {

  }

  ngOnInit() {
    console.log(this.tab)
  }

  changeTab(tabId: number) {
    this.tab?.setActiveTab(tabId);
  }

  doSignup() {
    console.log("signUp===>", this.signUpFormArray.value[0]);
    this.loginDataService
      .createUser(this.signUpFormArray.value[0])
      .subscribe((result: any) => {
        console.log(result);
      });
  }

  doSignin() {
    console.log("signInForm==>>", this.signInFormArray.value);
  }

  ngOnDestroy() {

  }
}
