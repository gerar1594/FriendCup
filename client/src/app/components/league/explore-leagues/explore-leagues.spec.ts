import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExploreLeagues } from './explore-leagues';

describe('ExploreLeagues', () => {
  let component: ExploreLeagues;
  let fixture: ComponentFixture<ExploreLeagues>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExploreLeagues],
    }).compileComponents();

    fixture = TestBed.createComponent(ExploreLeagues);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
