import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MedicationsService } from '../medications.service';
import { MEDICATION_STATUSES, MedicationStatus, STATUS_LABELS } from '../models';
import { ConnectivityService } from '../../core/connectivity.service';

@Component({
  selector: 'app-medication-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container" style="max-width:560px;">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ editing ? 'Edit Medication' : 'Add Medication' }}</h1>
          <p class="page-subtitle">Keep dosages, schedules, and prescribing details up to date.</p>
        </div>
      </div>

      <!-- Offline guard -->
      <div *ngIf="!connectivity.isOnline()" class="card offline-notice">
        <span class="offline-icon">📵</span>
        <p>Connect to the internet to {{ editing ? 'edit' : 'add' }} medications.</p>
        <a routerLink="/medications" class="btn btn-ghost btn-sm">← Back to Medications</a>
      </div>

      <div class="card" *ngIf="connectivity.isOnline() && !loadingExisting">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <div class="field">
            <label for="name">Medication Name</label>
            <input id="name" type="text" formControlName="name" placeholder="e.g. Metformin" />
            <span class="hint" *ngIf="form.get('name')?.invalid && form.get('name')?.touched">Required</span>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="dosage">Dosage</label>
              <input id="dosage" type="text" formControlName="dosage" placeholder="e.g. 500mg" />
              <span class="hint" *ngIf="form.get('dosage')?.invalid && form.get('dosage')?.touched">Required</span>
            </div>
            <div class="field">
              <label for="frequency">Frequency</label>
              <input id="frequency" type="text" formControlName="frequency" placeholder="e.g. Twice daily" />
              <span class="hint" *ngIf="form.get('frequency')?.invalid && form.get('frequency')?.touched">Required</span>
            </div>
          </div>

          <div class="field">
            <label for="prescribingDoctor">Prescribing Doctor <span style="font-weight:400;color:var(--color-text-muted);">(optional)</span></label>
            <input id="prescribingDoctor" type="text" formControlName="prescribingDoctor" />
          </div>

          <div class="field-row">
            <div class="field">
              <label for="startDate">Start Date</label>
              <input id="startDate" type="date" formControlName="startDate" />
              <span class="hint" *ngIf="form.get('startDate')?.invalid && form.get('startDate')?.touched">Required</span>
            </div>
            <div class="field">
              <label for="endDate">End Date <span style="font-weight:400;color:var(--color-text-muted);">(optional)</span></label>
              <input id="endDate" type="date" formControlName="endDate" />
            </div>
          </div>

          <div class="field" *ngIf="editing">
            <label for="status">Status</label>
            <select id="status" formControlName="status">
              <option *ngFor="let s of statuses" [value]="s">{{ statusLabel(s) }}</option>
            </select>
          </div>

          <div class="field">
            <label for="notes">Notes <span style="font-weight:400;color:var(--color-text-muted);">(optional)</span></label>
            <textarea id="notes" formControlName="notes" rows="2" style="resize:vertical;"></textarea>
          </div>

          <div *ngIf="errorMsg" class="entry-error" role="alert">{{ errorMsg }}</div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="submitting || form.invalid">
              {{ submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Add Medication') }}
            </button>
            <a routerLink="/medications" class="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class MedicationEntryFormComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private svc    = inject(MedicationsService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  readonly connectivity = inject(ConnectivityService);

  readonly statuses = MEDICATION_STATUSES;
  statusLabel = (s: MedicationStatus) => STATUS_LABELS[s];

  form!: FormGroup;
  editing        = false;
  medicationId   = '';
  loadingExisting = false;
  submitting     = false;
  errorMsg       = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      name:              ['', Validators.required],
      dosage:            ['', Validators.required],
      frequency:         ['', Validators.required],
      prescribingDoctor: [''],
      startDate:         [this.today(), Validators.required],
      endDate:           [''],
      status:            ['ACTIVE' as MedicationStatus],
      notes:             [''],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editing      = true;
      this.medicationId = id;
      this.loadingExisting = true;
      this.svc.getById(id).subscribe({
        next: m => {
          this.form.patchValue({
            name:              m.name,
            dosage:            m.dosage,
            frequency:         m.frequency,
            prescribingDoctor: m.prescribingDoctor ?? '',
            startDate:         m.startDate,
            endDate:           m.endDate ?? '',
            status:            m.status,
            notes:             m.notes ?? '',
          });
          this.loadingExisting = false;
        },
        error: () => {
          this.errorMsg = 'Failed to load medication.';
          this.loadingExisting = false;
        },
      });
    }
  }

  submit(): void {
    if (this.form.invalid || !this.connectivity.isOnline()) return;
    this.submitting = true;
    this.errorMsg   = '';

    const raw = this.form.value;
    const payload = {
      name:              raw.name,
      dosage:            raw.dosage,
      frequency:         raw.frequency,
      prescribingDoctor: raw.prescribingDoctor || undefined,
      startDate:         raw.startDate,
      endDate:           raw.endDate || undefined,
      notes:             raw.notes || undefined,
    };

    const request$ = this.editing
      ? this.svc.update(this.medicationId, { ...payload, status: raw.status })
      : this.svc.create(payload);

    request$.subscribe({
      next:  () => this.router.navigate(['/medications']),
      error: err => {
        this.submitting = false;
        this.errorMsg = err.error?.message ?? 'Failed to save medication.';
      },
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
