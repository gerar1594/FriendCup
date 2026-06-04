import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Clasification } from './clasification';

describe('Clasification', () => {
  let component: Clasification;
  let fixture: ComponentFixture<Clasification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Clasification],
    }).compileComponents();

    fixture = TestBed.createComponent(Clasification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
