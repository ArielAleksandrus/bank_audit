import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

import * as XLSX from 'xlsx';

import { SicoobParser } from '../shared/parsers/sicoob-parser';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-parser',
  imports: [
    CommonModule,
    NgbCollapseModule,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    NgSelectComponent
  ],
  templateUrl: './parser.component.html',
  styleUrl: './parser.component.scss'
})
export class ParserComponent {
  excelData: any[] = [];
  parser: any;

  availableTags: string[] = ["insumo", "equipamento", "utensílio", "gás", "aluguel"];

  receitaCollapsed: boolean = true;
  boletoCollapsed: boolean = true;

  constructor () {

  }
  ngOnInit() {
    this.parser = new SicoobParser();
  }

  extratoFileChanged(evt: any) {
    const file = evt.target.files[0];
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      this.excelData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
      this.parser.parseExtrato(this.excelData, 'excel');
    }
    
    reader.readAsBinaryString(file);
  }

  sendComprovante() {
    let txtArea: any = document.getElementById("comprovanteTxt");
    if(!txtArea)
      return;

    let value = txtArea.value;
    this.parser.parseComprovantes(value);
    alert("Enviado. Favor conferir se os beneficiários apareceram.");
  }

}
