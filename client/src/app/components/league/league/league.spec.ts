import { ComponentFixture, TestBed } from '@angular/core/testing';

import { League } from './league';

describe('League', () => {
  let component: League;
  let fixture: ComponentFixture<League>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [League],
    }).compileComponents();

    fixture = TestBed.createComponent(League);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
