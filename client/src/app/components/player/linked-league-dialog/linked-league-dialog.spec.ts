import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinkedLeagueDialog } from './linked-league-dialog';

describe('LinkedLeagueDialog', () => {
  let component: LinkedLeagueDialog;
  let fixture: ComponentFixture<LinkedLeagueDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkedLeagueDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkedLeagueDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
