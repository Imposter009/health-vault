import { Routes } from '@angular/router';
import { HealthCheckComponent } from './health-check/health-check.component';

export const routes: Routes = [
  { path: '', component: HealthCheckComponent },
  { path: '**', redirectTo: '' }
];
