import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCalendar, NgbDatepickerModule, NgbDate } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-date-range-picker',
  imports: [CommonModule, NgbDatepickerModule],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.scss'
})
export class DateRangePickerComponent {
  today = inject(NgbCalendar).getToday();
  hoveredDate: NgbDate | null = null;

  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;

  // to is null when only a single day was picked
  confirm = output<{ from: string, to: string | null }>();
  cancel = output<void>();

  onConfirm() {
    let fromStr = this.ngbDateToISO(this.fromDate);
    if(!fromStr) {
      return;
    }

    this.confirm.emit({ from: fromStr, to: this.ngbDateToISO(this.toDate) });
  }

  ngbDateToISO(date: NgbDate | null): string | null {
    if(!date)
      return null;

    let monthStr = String(date.month);
    if(date.month < 10)
      monthStr = "0" + monthStr;

    let dayStr = String(date.day);
    if(date.day < 10)
      dayStr = "0" + dayStr;

    return `${date.year}-${monthStr}-${dayStr}`;
  }

  onDateSelection(date: NgbDate) {
    if(!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if(this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
  }
  isHovered(date: NgbDate) {
    return (
      this.fromDate && !this.toDate && this.hoveredDate && date.after(this.fromDate) && date.before(this.hoveredDate)
    );
  }

  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate) && date.before(this.toDate);
  }

  isRange(date: NgbDate) {
    return (
      date.equals(this.fromDate) ||
      (this.toDate && date.equals(this.toDate)) ||
      this.isInside(date) ||
      this.isHovered(date)
    );
  }
}
