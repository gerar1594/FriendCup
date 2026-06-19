import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchChat } from './match-chat';

describe('MatchChat', () => {
  let component: MatchChat;
  let fixture: ComponentFixture<MatchChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchChat],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchChat);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
