import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home.component';
import { PipesApplicationModule } from 'src/app.pipes';



@NgModule({
  declarations: [
    HomeComponent
  ],
  imports: [
    CommonModule,
    PipesApplicationModule
  ]
})
export class HomeModule { }
