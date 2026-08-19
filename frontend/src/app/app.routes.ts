import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/profile', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'health-check',
    loadComponent: () => import('./health-check/health-check.component').then((m) => m.HealthCheckComponent)
  },
  {
    path: 'metrics',
    loadComponent: () => import('./metrics/list/metrics-list.component').then((m) => m.MetricsListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'metrics/new',
    loadComponent: () => import('./metrics/entry-form/metric-entry-form.component').then((m) => m.MetricEntryFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'documents',
    loadComponent: () => import('./documents/list/documents-list.component').then((m) => m.DocumentsListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'documents/upload',
    loadComponent: () => import('./documents/upload/document-upload.component').then((m) => m.DocumentUploadComponent),
    canActivate: [authGuard]
  },
  {
    path: 'documents/:id/view',
    loadComponent: () => import('./documents/viewer/document-viewer.component').then((m) => m.DocumentViewerComponent),
    canActivate: [authGuard]
  },
  {
    path: 'audit-log',
    loadComponent: () => import('./audit-log/audit-log.component').then((m) => m.AuditLogComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/login' }
];
