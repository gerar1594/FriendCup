import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictionModal } from './prediction-modal';

describe('PredictionModal', () => {
  let component: PredictionModal;
  let fixture: ComponentFixture<PredictionModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionModal],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
