import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictionModalView } from './prediction-modal-view';

describe('PredictionModalView', () => {
  let component: PredictionModalView;
  let fixture: ComponentFixture<PredictionModalView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionModalView],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionModalView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
