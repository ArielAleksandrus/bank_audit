import { Component, inject } from '@angular/core';

import { NgbCalendar, NgbDatepickerModule, NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../shared/services/api.service';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';

@Component({
  selector: 'app-dashboard',
  imports: [NgbDatepickerModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  today = inject(NgbCalendar).getToday();
  hoveredDate: NgbDate | null = null;

  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;

  constructor() {

  }

  queryEntries() {
    this.boletoQuery(this.fromDate, this.toDate);
  }

  boletoQuery(from: NgbDate|null, to: NgbDate|null) {
    let fromStr = this.ngbDateToISO(from);
    let toStr = this.ngbDateToISO(to);

    if(!fromStr) {
      return;
    }
    let val: any = fromStr
    if(toStr) {
      val = [fromStr, toStr];
    }

    let params: any = Boleto.queryParams("payment_date", val);

    console.log(params);
  }

  ngbDateToISO(date: NgbDate|null): string|null {
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

    console.log(this.fromDate, this.toDate);
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
