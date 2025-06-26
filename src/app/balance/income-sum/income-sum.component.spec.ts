import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncomeSumComponent } from './income-sum.component';

describe('IncomeSumComponent', () => {
  let component: IncomeSumComponent;
  let fixture: ComponentFixture<IncomeSumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeSumComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IncomeSumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
