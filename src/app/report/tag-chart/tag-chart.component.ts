import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';

import { Company } from '../../shared/models/company';
import { Boleto } from '../../shared/models/boleto';
import { Income } from '../../shared/models/income';
import { Purchase } from '../../shared/models/purchase';
import { Supplier } from '../../shared/models/supplier';
import { Tag } from '../../shared/models/tag';

import { BoletoComponent } from '../../balance/boleto/boleto.component';
import { IncomeComponent } from '../../balance/income/income.component';
import { PurchaseComponent } from '../../balance/purchase/purchase.component';

import { Reports, TagClassification } from '../../shared/parsers/reports';

import { Utils } from '../../shared/helpers/utils';

@Component({
  selector: 'app-tag-chart',
  imports: [CommonModule, ChartModule, FormsModule, 
            BoletoComponent, IncomeComponent, PurchaseComponent],
  templateUrl: './tag-chart.component.html',
  styleUrl: './tag-chart.component.scss'
})
export class TagChartComponent {
  selectedTags: {[tagName: string]: boolean} = {};
  chartTags: string[] = [];
  tagClassification = input.required<TagClassification>();

  chartData: any;

  constructor() {

  }

  ngOnInit() {
    this.genTagChart();
  }

  genTagChart() {
    this.selectedTags = {};
    for(let i = 0; i < this.tagClassification().classification.length; i++) {
      let tagVal = this.tagClassification().classification[i];
      this.chartTags.push(tagVal.tagName);
      
      if(i >= 7) {
        this.selectedTags[tagVal.tagName] = false;
        continue;
      }

      this.selectedTags[tagVal.tagName] = true;
    }

    this.changeTagSelection();
  }

  changeTagSelection() {
    let tags: string[] = [];
    let totals: number[] = [];
    for(let tagVal of this.tagClassification().classification) {
      if(this.selectedTags[tagVal.tagName]) {
        tags.push(tagVal.tagName);
        totals.push(tagVal.value);
      }
    }
    let tagCount: number = tags.length;
    let data: any = {
      labels: tags,
      datasets: [/*{
        type: 'line',
        label: 'Custo Total',
        borderWidth: 2,
        fill: false,
        data: Array(tagCount).fill(tagReport.total)
      }, */{
        type: 'bar',
        label: 'Custo Parcial',
        data: totals
      }]
    };

    this.chartData = data;
  }
}
