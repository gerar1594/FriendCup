import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaguesManagement } from './leagues-management';

describe('LeaguesManagement', () => {
  let component: LeaguesManagement;
  let fixture: ComponentFixture<LeaguesManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaguesManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaguesManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
