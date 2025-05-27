import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

import * as XLSX from 'xlsx';

import { SicoobParser } from '../shared/parsers/sicoob-parser';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { Tag } from '../shared/models/tag';
import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';

import { ApiService } from '../shared/services/api.service';

import { Utils } from '../shared/helpers/utils';
import { Filters } from '../shared/helpers/filters';

@Component({
  selector: 'app-parser',
  imports: [
    CommonModule,
    NgbCollapseModule,
    NgSelectComponent,
    NgbPopoverModule,
    FormsModule
  ],
  templateUrl: './parser.component.html',
  styleUrl: './parser.component.scss'
})
export class ParserComponent {
  company: Company = <Company>{id: -1};

  selectedBank?: 'sicoob';
  excelData: any[] = [];
  parser: any;

  availableTags: Tag[] = [];

  receitaCollapsed: boolean = true;
  boletoCollapsed: boolean = true;

  propagate: boolean = true;
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags do boleto serão copiadas para todos os boletos deste fornecedor";

  constructor (private api: ApiService) {
  }
  ngOnInit() {
    this.parser = new SicoobParser();
    this._loadCompany();
    //TODO: replace token to user-defined token received via input and stored in localstorage
    this.api.setAuth({token: this.company.token});

    this._loadTags().then((res: any) => {
      this._createSampleTags();
    });
  }

  bankChanged() {
    switch(this.selectedBank) {
    case("sicoob"): {
      this.parser = new SicoobParser();
      break;
    }
    }
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
      this.checkIfBoletosExist();
      this.checkIfIncomesExist();
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
    this.checkIfBoletosExist();
  }

  tagChanged(obj: any/*Boleto|Income|Purchase*/, tags: Tag[], objType: 'boleto') {
    let tagsAttr: string = 'none';
    let comparisonAttr: string = 'none';

    switch(objType) {
    case("boleto"): {
      tagsAttr = 'auxTags';
      comparisonAttr = 'supplier_name';
      break;
    }
    }

    for(let tag of tags) {
      if(tag.id == null) { // tag was not created
        tag.id = -(new Date().getTime()); // add a negative id so we can create it when user saves
      }
    }

    obj[tagsAttr] = tags;

    if(this.propagate)
      this._propagateTags(obj, tagsAttr, comparisonAttr, this.parser.boletos);
  }

  removeIncome(income: Income) {
    let idx = this.parser.incomes.indexOf(income);
    this.parser.incomes.splice(idx, 1);
    this.parser.recalculateIncome();

    let id = income.id;
    if(income.id > 0) {
      this.api.destroy('incomes', id).subscribe(
        (res: any) => {
          console.log(res);
        },
        (err: any) => {
          alert("Nao foi possivel remover a receita no servidor");
          console.error(err, income);
        }
      );
    }
  }

  send() {
    //TODO: save work in receita and other tables

    this.saveBoletos();
    this.saveIncomes();
  }

  saveBoletos(idx: number = 0) {
    return new Promise((resolve, reject) => {
      if(idx >= this.parser.boletos.length) {
        resolve(true);
        return;
      }

      let boleto = Utils.clone(this.parser.boletos[idx]);

      delete boleto.id;
      this.api.create('purchases/from_boleto', {
        boleto: boleto
      }).subscribe(
        (res: any) => {
          resolve(this.saveBoletos(idx + 1));
        },
        (err: any) => {
          console.log(err);
          reject(err);
        }
      );
    });
  }
  saveIncomes(idx: number = 0) {
    return new Promise((resolve, reject) => {
      if(idx >= this.parser.incomes.length) {
        resolve(true);
        return;
      }

      let income = Utils.clone(this.parser.incomes[idx]);

      let req: any = null;
      if(income.id > 0) {
        req = this.api.update('incomes', income.id, {income});
      } else {
        req = this.api.create('incomes', {income});
      }

      req.subscribe(
        (res: Income) => {
          this.parser.incomes[idx] = res;
          resolve(this.saveIncomes(idx + 1));
        },
        (err: any) => {
          console.error("Could not save income: ", income, err);
          reject(err);
        }
      );
    });
  }

  checkIfBoletosExist(idx: number = 0) {
    if(idx >= this.parser.boletos.length)
      return;

    let boleto = this.parser.boletos[idx];
    let params = {
      boleto: {
        bank_identification: boleto.bank_identification,
        bank_name: boleto.bank_name,
        value: boleto.value,
        payment_date: boleto.payment_date,
        supplier_name: boleto.supplier_name
      }
    }
    this.api.show('boletos', 'exists', params).subscribe(
      (res: Boleto|null) => {
        if(res && res.id) {
          this.parser.boletos[idx] = res;
        }

        this.checkIfBoletosExist(idx + 1);
      }
    );
  }
  checkIfIncomesExist(idx: number = 0) {
    if(idx >= this.parser.incomes.length)
      return;

    let income: Income = this.parser.incomes[idx];
    let params = {
      income: {
        bank_name: income.bank_name,
        bank_identification: income.bank_identification,
        value: income.value,
        date_received: income.date_received,
        origin: income.origin,
        income_type: income.income_type
      }
    }
    this.api.show('incomes', 'exists', params).subscribe(
      (res: Boleto|null) => {
        if(res && res.id) {
          this.parser.incomes[idx] = res;
        }

        this.checkIfIncomesExist(idx + 1);
      }
    );
  }

  createTags(tags: Tag[], idx: number = 0) {
    let tag = tags[idx];
    return new Promise((resolve, reject) => {
      if(idx >= tags.length) {
        resolve('done');
        return;
      }

      if(tag.id > 0){
        resolve(this.createTags(tags, idx + 1));
      } else {
        this.createTag(tag).then(
          res => {
            resolve(this.createTags(tags, idx + 1));
          },
          err => {
            resolve(this.createTags(tags, idx + 1));
          }
        );
      }
    });
  }
  createTag(tag: Tag) {
    return new Promise((resolve, reject) => {
      if(tag.id > 0) { // tag already exists
        resolve(tag);
        return;
      }

      this.api.create("tags", {name: tag.name}).subscribe(
        (res: any) => {
          this._addToAvailableTags([res]);
          resolve(res);
        },
        (err: any) => {
          console.error("Could not create tag '" + name + "'");
          reject(err);
        }
      )
    });
  }

  private _createSampleTags(idx: number = 0): any {
    let sampleTags: any[] = [{name: "Insumo"}, {name: "Equipamento"}, {name: "Utensílio"}, {name: "Gás"}, {name: "Aluguel"}];
    if(idx >= sampleTags.length)
      return;

    // if already exists, do nothing
    if(Utils.findById(sampleTags[idx].name, this.availableTags, 'name'))
      return this._createSampleTags(idx + 1);

    this.createTag(<Tag>{name: sampleTags[idx].name}).then(
      res => {
        this._createSampleTags(idx + 1);
      }
    );
  }

  private _loadCompany() {
    let loaded = Company.loadCompany();
    if(loaded && loaded.token) {
      this.company = loaded;
    } else {
      location.href = '/login';
    }
  }

  private _loadTags() {
    this.availableTags = [];

    const query = {
      q: {
        company_id: this.company.id
      }
    };

    return new Promise((resolve, reject) => {
      this.api.indexAll('tags', query).subscribe(
        (res: any) => {
          this._addToAvailableTags(res);
          resolve(res);
        },
        (err: any) => {
          console.log(err);
          reject(err);
        }
      );
    })
  }
  private _addToAvailableTags(tags: Tag[]) {
    let clone: Tag[] = Utils.clone(this.availableTags);
    
    for(let tag of tags) {
      const existing = Utils.findById(tag.name, this.availableTags, 'name');
      if(!existing){
        clone.push(tag);
      }
    }
    this.availableTags = Filters.orderAlphabetically(clone, 'name', false);
  }
  private _propagateTags(changedObj: any, tagsAttr: string, comparisonAttr: string, dataArr: any[]) {
    let changed: number = 0;

    let tags = changedObj[tagsAttr];
    if(!tags) {
      console.error("ParserComponent->propagateTags: tags attribute is an empty object");
      return;
    }

    for(let i = 0; i < dataArr.length; i++) {
      let dataObj = dataArr[i];
      if(changedObj[comparisonAttr] == dataObj[comparisonAttr] && !Utils.equals(changedObj[tagsAttr], dataObj[tagsAttr])) {
        dataObj[tagsAttr] = Utils.clone(changedObj[tagsAttr]);
        changed++;
      }
    }
  }
}
