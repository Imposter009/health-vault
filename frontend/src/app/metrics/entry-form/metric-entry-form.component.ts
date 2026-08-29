import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MetricsService } from '../metrics.service';
import { MetricType } from '../models';
import { ConnectivityService } from '../../core/connectivity.service';

@Component({
  selector: 'app-metric-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container" style="max-width:560px;">
      <div class="page-header">
        <h1 class="page-title">Log Health Metric</h1>
      </div>

      <!-- Offline guard -->
      <div *ngIf="!connectivity.isOnline()" class="card offline-notice">
        <span class="offline-icon">📵</span>
        <p>Connect to the internet to add new entries.</p>
        <a routerLink="/metrics" class="btn btn-ghost btn-sm">← Back to Metrics</a>
      </div>

      <div class="card" *ngIf="connectivity.isOnline()">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <div class="field">
            <label for="metricType">Metric Type</label>
            <select id="metricType" formControlName="metricType" (change)="onTypeChange()">
              <option value="">Select a metric…</option>
              <option *ngFor="let t of metricTypes" [value]="t">{{ t | titlecase }}</option>
            </select>
          </div>

          <div class="field">
            <label for="recordedAt">Recorded At</label>
            <input id="recordedAt" type="datetime-local" formControlName="recordedAt" />
          </div>

          <!-- BLOOD_PRESSURE -->
          <ng-container *ngIf="selectedType === 'BLOOD_PRESSURE'" [formGroup]="valueGroup">
            <div class="field">
              <label>Systolic (mmHg)</label>
              <input type="number" formControlName="systolic" min="60" max="250" />
              <span class="hint" *ngIf="valueGroup.get('systolic')?.invalid && valueGroup.get('systolic')?.touched">Required</span>
            </div>
            <div class="field">
              <label>Diastolic (mmHg)</label>
              <input type="number" formControlName="diastolic" min="40" max="150" />
              <span class="hint" *ngIf="valueGroup.get('diastolic')?.invalid && valueGroup.get('diastolic')?.touched">Required</span>
            </div>
          </ng-container>

          <!-- BLOOD_SUGAR -->
          <ng-container *ngIf="selectedType === 'BLOOD_SUGAR'" [formGroup]="valueGroup">
            <div class="field">
              <label>Blood Sugar (mg/dL)</label>
              <input type="number" formControlName="mgPerDl" min="20" max="600" />
              <span class="hint" *ngIf="valueGroup.get('mgPerDl')?.invalid && valueGroup.get('mgPerDl')?.touched">Required</span>
            </div>
            <div class="field">
              <label>Context</label>
              <select formControlName="context">
                <option value="FASTING">Fasting</option>
                <option value="POST_MEAL">Post Meal</option>
                <option value="RANDOM">Random</option>
              </select>
            </div>
          </ng-container>

          <!-- WEIGHT -->
          <ng-container *ngIf="selectedType === 'WEIGHT'" [formGroup]="valueGroup">
            <div class="field">
              <label>Weight (kg)</label>
              <input type="number" step="0.1" formControlName="kg" min="20" max="300" />
              <span class="hint" *ngIf="valueGroup.get('kg')?.invalid && valueGroup.get('kg')?.touched">Required</span>
            </div>
          </ng-container>

          <!-- WORKOUT -->
          <ng-container *ngIf="selectedType === 'WORKOUT'" [formGroup]="valueGroup">
            <div class="field">
              <label>Activity Type</label>
              <input type="text" formControlName="type" placeholder="e.g. Running, Cycling, Yoga" />
              <span class="hint" *ngIf="valueGroup.get('type')?.invalid && valueGroup.get('type')?.touched">Required</span>
            </div>
            <div class="field">
              <label>Duration (minutes)</label>
              <input type="number" formControlName="durationMinutes" min="1" max="600" />
              <span class="hint" *ngIf="valueGroup.get('durationMinutes')?.invalid && valueGroup.get('durationMinutes')?.touched">Required</span>
            </div>
            <div class="field">
              <label>Intensity</label>
              <select formControlName="intensity">
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </ng-container>

          <!-- HEART_RATE -->
          <ng-container *ngIf="selectedType === 'HEART_RATE'" [formGroup]="valueGroup">
            <div class="field">
              <label>Heart Rate (BPM)</label>
              <input type="number" formControlName="bpm" min="30" max="250" />
              <span class="hint" *ngIf="valueGroup.get('bpm')?.invalid && valueGroup.get('bpm')?.touched">Required</span>
            </div>
          </ng-container>

          <div class="field">
            <label for="notes">Notes <span style="font-weight:400;color:#94a3b8;">(optional)</span></label>
            <textarea id="notes" formControlName="notes" rows="2" style="resize:vertical;"></textarea>
          </div>

          <div *ngIf="errorMsg" class="entry-error" role="alert">{{ errorMsg }}</div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="submitting || form.invalid">
              {{ submitting ? 'Saving…' : 'Save Metric' }}
            </button>
            <a routerLink="/metrics" class="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .offline-notice { text-align:center; padding:2.5rem; }
    .offline-icon { font-size:2rem; display:block; margin-bottom:.75rem; }
    .offline-notice p { margin:0 0 1.25rem; color:var(--color-text-secondary,#64748b); }
    .form-actions { display:flex; gap:.75rem; margin-top:1.5rem; align-items:center; }
    .entry-error { color:var(--color-danger,#dc2626); font-size:.875rem; margin:.5rem 0; }
  `]
})
export class MetricEntryFormComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private svc    = inject(MetricsService);
  private router = inject(Router);
  readonly connectivity = inject(ConnectivityService);

  readonly metricTypes: MetricType[] = [
    'BLOOD_PRESSURE', 'BLOOD_SUGAR', 'WEIGHT', 'WORKOUT', 'HEART_RATE'
  ];

  form!: FormGroup;
  submitting = false;
  errorMsg   = '';

  get selectedType(): MetricType | '' { return this.form.get('metricType')?.value ?? ''; }
  get valueGroup():   FormGroup       { return this.form.get('value') as FormGroup; }

  ngOnInit(): void {
    this.form = this.fb.group({
      metricType: ['', Validators.required],
      recordedAt: [this.nowLocal(), Validators.required],
      value:      this.fb.group({}),
      notes:      [''],
    });
  }

  onTypeChange(): void {
    this.errorMsg = '';
    this.form.setControl('value', this.buildValueGroup(this.selectedType as MetricType));
  }

  private buildValueGroup(type: MetricType): FormGroup {
    switch (type) {
      case 'BLOOD_PRESSURE': return this.fb.group({ systolic: [null, Validators.required], diastolic: [null, Validators.required] });
      case 'BLOOD_SUGAR':    return this.fb.group({ mgPerDl: [null, Validators.required], context: ['FASTING', Validators.required] });
      case 'WEIGHT':         return this.fb.group({ kg: [null, Validators.required] });
      case 'WORKOUT':        return this.fb.group({ type: ['', Validators.required], durationMinutes: [null, Validators.required], intensity: ['MODERATE', Validators.required] });
      case 'HEART_RATE':     return this.fb.group({ bpm: [null, Validators.required] });
      default:               return this.fb.group({});
    }
  }

  submit(): void {
    if (this.form.invalid || !this.connectivity.isOnline()) return;
    this.submitting = true;
    this.errorMsg   = '';

    const raw     = this.form.value;
    const payload = {
      metricType: raw.metricType as MetricType,
      value:      raw.value,
      recordedAt: new Date(raw.recordedAt).toISOString(),
      notes:      raw.notes || undefined,
    };

    this.svc.create(payload).subscribe({
      next:  () => this.router.navigate(['/metrics']),
      error: err => {
        this.submitting = false;
        this.errorMsg = err.error?.message ?? 'Failed to save metric.';
      },
    });
  }

  cancel(): void { this.router.navigate(['/metrics']); }

  private nowLocal(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
}
