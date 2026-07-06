import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoseTracker } from './pose-tracker';

describe('PoseTracker', () => {
  let component: PoseTracker;
  let fixture: ComponentFixture<PoseTracker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoseTracker],
    }).compileComponents();

    fixture = TestBed.createComponent(PoseTracker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
