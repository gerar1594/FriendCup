import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchChatDialog } from './match-chat-dialog';

describe('MatchChatDialog', () => {
  let component: MatchChatDialog;
  let fixture: ComponentFixture<MatchChatDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchChatDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchChatDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
