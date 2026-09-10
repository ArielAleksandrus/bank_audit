import { Component, inject, LOCALE_ID, OnDestroy, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCalendar, NgbDatepickerI18n, NgbDatepickerI18nDefault, NgbDatepickerModule, NgbDate } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-date-range-picker',
  imports: [CommonModule, NgbDatepickerModule],
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: NgbDatepickerI18n, useClass: NgbDatepickerI18nDefault }
  ],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.scss'
})
export class DateRangePickerComponent implements OnInit, OnDestroy {
  today = inject(NgbCalendar).getToday();
  hoveredDate: NgbDate | null = null;

  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  displayMonths = 2;

  private mq?: MediaQueryList;
  private onMqChange = (e: MediaQueryListEvent) => {
    this.displayMonths = e.matches ? 1 : 2;
  };

  // to is null when only a single day was picked
  confirm = output<{ from: string, to: string | null }>();
  cancel = output<void>();

  ngOnInit() {
    this.mq = window.matchMedia('(max-width: 720px)');
    this.displayMonths = this.mq.matches ? 1 : 2;
    this.mq.addEventListener('change', this.onMqChange);
  }

  ngOnDestroy() {
    this.mq?.removeEventListener('change', this.onMqChange);
  }

  formatDate(date: NgbDate | null): string {
    if(!date) return '';
    const day = String(date.day).padStart(2, '0');
    const month = String(date.month).padStart(2, '0');
    return `${day}/${month}/${date.year}`;
  }

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
