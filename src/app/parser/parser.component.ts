import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

import * as XLSX from 'xlsx';

import { SicoobParser } from '../shared/parsers/sicoob-parser';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

import { Utils } from '../shared/helpers/utils';

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

  availableTags: string[] = [];

  receitaCollapsed: boolean = true;
  boletoCollapsed: boolean = true;

  constructor () {

  }
  ngOnInit() {
    this.parser = new SicoobParser();
    this._loadTags();
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

  setComprovante() {
    let txtArea: any = document.getElementById("comprovanteTxt");
    if(!txtArea)
      return;

    let value = txtArea.value;
    this.parser.parseComprovantes(value);
    alert("Enviado. Favor conferir se os beneficiários apareceram.");
  }

  tagChanged(row: any, tags: string[], table: 'receita'|'boleto') {
    row[row.length - 1] = tags;

    let descIdx: number = -1;
    switch(table) {
    case("boleto"): {
      descIdx = 2;
      break;
    }
    case("receita"): {
      //TODO
      break;
    }
    }

    this._propagateTags(row[descIdx], tags, this.parser.organizedData[table], descIdx);

    this.sendTags({
      bank_identification: row[1],
      supplier_name: row[2],
      tags: tags
    });
  }

  sendTags(entryTags: {bank_identification: string, supplier_name: string, tags: string[]}) {
    console.log(entryTags);
    this._addToAvailableTags(entryTags.tags);
    //TODO: send to server
  }

  private _loadTags() {
    this.availableTags = ["Insumo", "Equipamento", "Utensílio", "Gás", "Aluguel"];

    //TODO: query available tags
  }
  private _addToAvailableTags(tags: string[]) {
    for(let tag of tags) {
      const tagIdx = this.availableTags.indexOf(tag);
      if(tagIdx == -1){
        let clone: string[] = Utils.clone(this.availableTags);
        clone.push(tag);
        this.availableTags = clone;
      }
    }
  }
  private _propagateTags(desc: string, tags: string[], rows: any, descIdx: number) {
    // not working. ngselect is not updated. only the data is.
    // TRANSFORM THE TAGS ARRAY INTO ARRAY OF OBJECTS
    return;
    let changed: number = 0;
    for(let i = 0; i < rows.length; i++) {
      let row = rows[i];
      if(row[descIdx] == desc && !Utils.equals(row[row.length - 1], tags)) {
        row[row.length - 1] = Utils.clone(tags);
        console.log(i, row);
        changed++;
      }
    }
  }
}
