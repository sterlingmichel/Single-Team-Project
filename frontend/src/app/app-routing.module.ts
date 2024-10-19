import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login', loadChildren: () => import('./login/login.module').then((m) => m.LoginModule),
    canActivate: [],
    data: {}
  },
  {
    path: 'home', loadChildren: () => import('./home/home.module').then((m) => m.HomeModule),
    canActivate: [],
    data: {}
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
