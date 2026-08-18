import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MetricsService } from '../metrics.service';
import { MetricType } from '../models';

@Component({
  selector: 'app-metric-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-container">
      <h2>Log Health Metric</h2>

      <form [formGroup]="form" (ngSubmit)="submit()">

        <div class="field">
          <label>Metric Type</label>
          <select formControlName="metricType" (change)="onTypeChange()">
            <option value="">-- Select --</option>
            <option *ngFor="let t of metricTypes" [value]="t">{{ t | titlecase }}</option>
          </select>
        </div>

        <div class="field">
          <label>Recorded At</label>
          <input type="datetime-local" formControlName="recordedAt" />
        </div>

        <!-- BLOOD_PRESSURE -->
        <ng-container *ngIf="selectedType === 'BLOOD_PRESSURE'" [formGroup]="valueGroup">
          <div class="field">
            <label>Systolic (mmHg)</label>
            <input type="number" formControlName="systolic" />
          </div>
          <div class="field">
            <label>Diastolic (mmHg)</label>
            <input type="number" formControlName="diastolic" />
          </div>
        </ng-container>

        <!-- BLOOD_SUGAR -->
        <ng-container *ngIf="selectedType === 'BLOOD_SUGAR'" [formGroup]="valueGroup">
          <div class="field">
            <label>mg/dL</label>
            <input type="number" formControlName="mgPerDl" />
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
            <input type="number" step="0.1" formControlName="kg" />
          </div>
        </ng-container>

        <!-- WORKOUT -->
        <ng-container *ngIf="selectedType === 'WORKOUT'" [formGroup]="valueGroup">
          <div class="field">
            <label>Activity Type</label>
            <input type="text" formControlName="type" placeholder="e.g. RUNNING" />
          </div>
          <div class="field">
            <label>Duration (minutes)</label>
            <input type="number" formControlName="durationMinutes" />
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
            <label>BPM</label>
            <input type="number" formControlName="bpm" />
          </div>
        </ng-container>

        <div class="field">
          <label>Notes (optional)</label>
          <textarea formControlName="notes" rows="2"></textarea>
        </div>

        <div *ngIf="errorMsg" class="error">{{ errorMsg }}</div>

        <div class="actions">
          <button type="submit" [disabled]="submitting">
            {{ submitting ? 'Saving…' : 'Save Metric' }}
          </button>
          <button type="button" (click)="cancel()">Cancel</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-container { max-width: 480px; margin: 2rem auto; padding: 1.5rem;
      border: 1px solid #ddd; border-radius: 8px; }
    .field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 0.85rem; font-weight: 600; }
    input, select, textarea { padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; }
    .actions { display: flex; gap: 1rem; margin-top: 1rem; }
    button { padding: 0.5rem 1.2rem; cursor: pointer; border-radius: 4px; border: none; }
    button[type=submit] { background: #2563eb; color: white; }
    button[type=button] { background: #e5e7eb; }
    .error { color: #dc2626; margin-bottom: 0.5rem; font-size: 0.9rem; }
  `]
})
export class MetricEntryFormComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private svc    = inject(MetricsService);
  private router = inject(Router);

  readonly metricTypes: MetricType[] = [
    'BLOOD_PRESSURE', 'BLOOD_SUGAR', 'WEIGHT', 'WORKOUT', 'HEART_RATE'
  ];

  form!: FormGroup;
  submitting = false;
  errorMsg   = '';

  get selectedType(): MetricType | '' {
    return this.form.get('metricType')?.value ?? '';
  }

  get valueGroup(): FormGroup {
    return this.form.get('value') as FormGroup;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      metricType:  ['', Validators.required],
      recordedAt:  [this.nowLocal(), Validators.required],
      value:       this.fb.group({}),
      notes:       [''],
    });
  }

  onTypeChange(): void {
    this.errorMsg = '';
    this.form.setControl('value', this.buildValueGroup(this.selectedType as MetricType));
  }

  private buildValueGroup(type: MetricType): FormGroup {
    switch (type) {
      case 'BLOOD_PRESSURE':
        return this.fb.group({
          systolic:  [null, Validators.required],
          diastolic: [null, Validators.required],
        });
      case 'BLOOD_SUGAR':
        return this.fb.group({
          mgPerDl:  [null, Validators.required],
          context:  ['FASTING', Validators.required],
        });
      case 'WEIGHT':
        return this.fb.group({ kg: [null, Validators.required] });
      case 'WORKOUT':
        return this.fb.group({
          type:            ['', Validators.required],
          durationMinutes: [null, Validators.required],
          intensity:       ['MODERATE', Validators.required],
        });
      case 'HEART_RATE':
        return this.fb.group({ bpm: [null, Validators.required] });
      default:
        return this.fb.group({});
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.errorMsg   = '';

    const raw = this.form.value;
    const payload = {
      metricType: raw.metricType as MetricType,
      value:      raw.value,
      recordedAt: new Date(raw.recordedAt).toISOString(),
      notes:      raw.notes || undefined,
    };

    this.svc.create(payload).subscribe({
      next: () => this.router.navigate(['/metrics']),
      error: (err) => {
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
