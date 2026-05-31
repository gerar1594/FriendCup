import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModifyMatchDialog } from './modify-match-dialog';

describe('ModifyMatchDialog', () => {
  let component: ModifyMatchDialog;
  let fixture: ComponentFixture<ModifyMatchDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModifyMatchDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(ModifyMatchDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
