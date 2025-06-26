import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Income, IncomeSummary } from '../../shared/models/income';

@Component({
  selector: 'app-income-sum',
  imports: [CommonModule, FormsModule],
  templateUrl: './income-sum.component.html',
  styleUrl: './income-sum.component.scss'
})
export class IncomeSumComponent {
  summary = input<IncomeSummary>();

  constructor() {
  }
}
