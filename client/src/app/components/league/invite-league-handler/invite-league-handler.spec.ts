import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteLeagueHandler } from './invite-league-handler';

describe('InviteLeagueHandler', () => {
  let component: InviteLeagueHandler;
  let fixture: ComponentFixture<InviteLeagueHandler>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteLeagueHandler],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteLeagueHandler);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
