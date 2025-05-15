import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import * as XLSX from 'xlsx';

import { SicoobParser } from '../shared/parsers/sicoob-parser';

@Component({
  selector: 'app-parser',
  imports: [CommonModule],
  templateUrl: './parser.component.html',
  styleUrl: './parser.component.scss'
})
export class ParserComponent {
  excelData: any[] = [];
  parser: any;

  constructor () {

  }
  ngOnInit() {

  }

  extratoFileChanged(evt: any) {
    const file = evt.target.files[0];
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      this.excelData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
      console.log('Excel data:', this.excelData);
      this.parser = new SicoobParser(this.excelData, 'excel');
    }
    
    reader.readAsBinaryString(file);
  }

}
