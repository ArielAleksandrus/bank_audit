import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParserComponent } from './parser.component';

describe('ParserComponent', () => {
  let component: ParserComponent;
  let fixture: ComponentFixture<ParserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
