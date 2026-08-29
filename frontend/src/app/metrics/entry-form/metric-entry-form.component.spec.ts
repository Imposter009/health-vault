import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricEntryFormComponent } from './metric-entry-form.component';
import { MetricsService } from '../metrics.service';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { MetricResponse } from '../models';
import { ConnectivityService } from '../../core/connectivity.service';

const mockMetric: MetricResponse = {
  id: 'x', userId: 'u', metricType: 'WEIGHT', value: { kg: 72.5 },
  recordedAt: '2026-08-01T08:00:00Z', source: 'MANUAL', notes: null,
  createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z',
};

describe('MetricEntryFormComponent', () => {
  let fixture: ComponentFixture<MetricEntryFormComponent>;
  let comp:    MetricEntryFormComponent;
  let svcSpy:  jasmine.SpyObj<MetricsService>;
  let router:  Router;

  beforeEach(async () => {
    svcSpy = jasmine.createSpyObj('MetricsService', ['create']);

    const connectivityStub = { isOnline: signal(true) };

    await TestBed.configureTestingModule({
      imports: [MetricEntryFormComponent, ReactiveFormsModule, CommonModule, RouterTestingModule],
      providers: [
        { provide: MetricsService,      useValue: svcSpy },
        { provide: ActivatedRoute,      useValue: { snapshot: { params: {} } } },
        { provide: ConnectivityService, useValue: connectivityStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(MetricEntryFormComponent);
    comp    = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component', () => {
    expect(comp).toBeTruthy();
  });

  it('form is initially invalid (no metricType selected)', () => {
    expect(comp.form.invalid).toBeTrue();
  });

  it('selecting WEIGHT builds weight value group with kg control', () => {
    comp.form.get('metricType')!.setValue('WEIGHT');
    comp.onTypeChange();
    fixture.detectChanges();
    expect(comp.valueGroup.contains('kg')).toBeTrue();
  });

  it('selecting BLOOD_PRESSURE builds group with systolic and diastolic', () => {
    comp.form.get('metricType')!.setValue('BLOOD_PRESSURE');
    comp.onTypeChange();
    expect(comp.valueGroup.contains('systolic')).toBeTrue();
    expect(comp.valueGroup.contains('diastolic')).toBeTrue();
  });

  it('selecting BLOOD_SUGAR builds group with mgPerDl and context', () => {
    comp.form.get('metricType')!.setValue('BLOOD_SUGAR');
    comp.onTypeChange();
    expect(comp.valueGroup.contains('mgPerDl')).toBeTrue();
    expect(comp.valueGroup.contains('context')).toBeTrue();
  });

  it('selecting WORKOUT builds group with type, durationMinutes, intensity', () => {
    comp.form.get('metricType')!.setValue('WORKOUT');
    comp.onTypeChange();
    expect(comp.valueGroup.contains('type')).toBeTrue();
    expect(comp.valueGroup.contains('durationMinutes')).toBeTrue();
    expect(comp.valueGroup.contains('intensity')).toBeTrue();
  });

  it('selecting HEART_RATE builds group with bpm', () => {
    comp.form.get('metricType')!.setValue('HEART_RATE');
    comp.onTypeChange();
    expect(comp.valueGroup.contains('bpm')).toBeTrue();
  });

  it('submit calls service.create and navigates to /metrics on success', () => {
    svcSpy.create.and.returnValue(of(mockMetric));
    comp.form.get('metricType')!.setValue('WEIGHT');
    comp.onTypeChange();
    comp.valueGroup.get('kg')!.setValue(72.5);
    comp.form.get('recordedAt')!.setValue('2026-08-01T08:00');

    comp.submit();
    expect(svcSpy.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/metrics']);
  });

  it('submit shows errorMsg when service call fails', () => {
    svcSpy.create.and.returnValue(throwError(() => ({ error: { message: 'Bad value' } })));
    comp.form.get('metricType')!.setValue('WEIGHT');
    comp.onTypeChange();
    comp.valueGroup.get('kg')!.setValue(-5);
    comp.form.get('recordedAt')!.setValue('2026-08-01T08:00');

    comp.submit();
    expect(comp.errorMsg).toBe('Bad value');
  });

  it('cancel navigates to /metrics', () => {
    comp.cancel();
    expect(router.navigate).toHaveBeenCalledWith(['/metrics']);
  });
});
