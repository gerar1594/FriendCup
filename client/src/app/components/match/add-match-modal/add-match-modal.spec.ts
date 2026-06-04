import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMatchModal } from './add-match-modal';

describe('AddMatchModal', () => {
  let component: AddMatchModal;
  let fixture: ComponentFixture<AddMatchModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMatchModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AddMatchModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
