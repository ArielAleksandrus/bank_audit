import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagDescriptionComponent } from './tag-description.component';

describe('TagDescriptionComponent', () => {
  let component: TagDescriptionComponent;
  let fixture: ComponentFixture<TagDescriptionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagDescriptionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TagDescriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
