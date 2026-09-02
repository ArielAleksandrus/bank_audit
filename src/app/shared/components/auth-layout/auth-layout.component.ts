import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBuildingColumns,
  faChartPie,
  faFileInvoiceDollar
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-auth-layout',
  imports: [CommonModule, FaIconComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {
  @Input() heading = '';
  @Input() subheading = '';

  bankIcon = faBuildingColumns;
  invoiceIcon = faFileInvoiceDollar;
  chartIcon = faChartPie;
}
