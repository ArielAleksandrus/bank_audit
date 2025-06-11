import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

import * as XLSX from 'xlsx';

import { BalanceParser } from '../shared/parsers/balance-parser';
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
  parser: BalanceParser;

  availableTags: Tag[] = [];
  suggestions: {[supplierName: string]: Tag[]} = {};

  receitaCollapsed: boolean = true;
  boletoCollapsed: boolean = true;
  despesaCollapsed: boolean = true;

  propagate: boolean = true;
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags do boleto serão copiadas para todos os boletos deste fornecedor";

  sending: boolean = false;
  sendingCount: number = 0;

  constructor (private api: ApiService) {
    this.parser = new SicoobParser(); // pick any parser to begin with. user can change it later
  }
  ngOnInit() {
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
      this.checkIfPurchasesExist();
    }
    
    reader.readAsBinaryString(file);
  }

  setComprovante() {
    let txtArea: any = document.getElementById("comprovanteTxt");
    if(!txtArea)
      return;

    let value = txtArea.value;
    this.parser.parseComprovantes(value);
    alert("Comprovantes enviados. Favor conferir se as informações estão corretas.");
    this.checkIfBoletosExist();
  }

  tagChanged(obj: Boleto|Purchase, tags: Tag[], objType: 'boleto'|'purchase') {
    let tagsAttr: string = 'none';
    let comparisonAttr: string = 'none';
    let dataArr: any[];

    switch(objType) {
    case("boleto"): {
      tagsAttr = 'auxTags';
      comparisonAttr = 'supplier_name';
      dataArr = this.parser.boletos;
      break;
    }
    case("purchase"): {
      tagsAttr = 'tags';
      comparisonAttr = 'supplier_name';
      dataArr = this.parser.purchases;
      break;
    }
    }

    for(let tag of tags) {
      if(tag.id == null) { // tag was not created
        tag.id = -(new Date().getTime()); // add a negative id so we can create it when user saves
        this.availableTags.push(tag);
        this.availableTags = Utils.clone(this.availableTags);
      }
    }

    //@ts-ignore
    obj[tagsAttr] = tags;

    if(this.propagate)
      this._propagateTags(obj, tagsAttr, comparisonAttr, dataArr);
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
    this.sendingCount = this.parser.boletos.length + this.parser.purchases.length + this.parser.incomes.length;
    this.sending = true;
    this.saveBoletos().then(res => {
      this.saveIncomes().then(res2 => {
        this.savePurchases().then(res3 => {
          this.sending = false;
        })
      })
    });
  }

  saveBoletos(idx: number = 0) {
    return new Promise((resolve, reject) => {
      if(idx >= this.parser.boletos.length) {
        resolve(true);
        return;
      }
      this.sendingCount -= 1;

      let boleto = Utils.clone(this.parser.boletos[idx]);

      if(boleto.purchase_id > 0) {
        this.sendBoleto(boleto).then( res => {
          this.parser.boletos[idx] = res;
          resolve(this.saveBoletos(idx + 1));
        })
      } else {
        // I had two boletos of Anapool, of the same value, payed at the same time
        // 1 of them was connected to my restaurant, and the other to the pizza restaurant
        // therefore, when creating boletos, we have to disable Purchase's anti-duplicate check
        this.sendPurchase(Purchase.fromBoleto(boleto), false).then( purchase => {
          boleto.purchase_id = purchase.id;
          this.sendBoleto(boleto).then( res => {
            this.parser.boletos[idx] = res;
            resolve(this.saveBoletos(idx + 1));
          })
        });
      }
    });
  }
  sendBoleto(boleto: Boleto): Promise<Boleto> {
    return new Promise((resolve, reject) => {
      let req: any = null;
      if(boleto.id > 0) {
        req = this.api.update('boletos', boleto.id, {boleto});
      } else {
        req = this.api.create('boletos', {boleto});
      }

      req.subscribe(
        (res: Boleto) => {
          resolve(res);
        },
        (err: any) => {
          console.error("Could not save boleto: ", boleto, err);
          reject(err);
        }
      );
    })
  }
  saveIncomes(idx: number = 0) {
    return new Promise((resolve, reject) => {
      if(idx >= this.parser.incomes.length) {
        resolve(true);
        return;
      }
      this.sendingCount -= 1;

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
  savePurchases(idx: number = 0): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if(idx >= this.parser.purchases.length) {
        resolve(true);
        return;
      }
      this.sendingCount -= 1;

      let purchase = Utils.clone(this.parser.purchases[idx]);

      this.sendPurchase(purchase).then( res => {
        this.parser.purchases[idx] = res;
        resolve(this.savePurchases(idx + 1));
      });
    });
  }
  sendPurchase(purchase: Purchase, avoidDuplicates: boolean = true): Promise<Purchase> {
    return new Promise((resolve, reject) => {
      let req: any = null;
      if(purchase.id > 0) {
        req = this.api.update('purchases', purchase.id, {purchase});
      } else {
        req = this.api.create('purchases', {
          purchase: purchase,
          avoid_duplicates: avoidDuplicates
        });
      }

      req.subscribe(
        (res: Purchase) => {
          resolve(res);
        },
        (err: any) => {
          console.error("Could not save purchase: ", purchase, err);
          reject(err);
        }
      );
    })
  }

  checkIfBoletosExist() {
    let params = {
      boletos: Boleto.arrayExistsParams(this.parser.boletos)
    }

    this.api.req('boletos', params, {collection: 'exists'}, 'post').subscribe(
      (res: {boletos: Boleto[]}) => {
        for(let i = 0; i < this.parser.boletos.length; i++) {
          if(res.boletos[i] && res.boletos[i].id > 0) {
            this.parser.boletos[i] = new Boleto(res.boletos[i]);
          }
        }
        this.loadSuggestions(Boleto.getSupplierNames(this.parser.boletos));
      },
      (err: any) => {
        alert("Erro ao buscar boletos existentes");
        console.error(err);
      }
    );
  }
  checkIfPurchasesExist() {
    let params = {
      purchases: Purchase.arrayExistsParams(this.parser.purchases)
    }

    this.api.req('purchases', params, {collection: 'exists'}, 'post').subscribe(
      (res: {purchases: Purchase[]}) => {
        for(let i = 0; i < this.parser.purchases.length; i++) {
          if(res.purchases[i] && res.purchases[i].id > 0) {
            this.parser.purchases[i] = new Purchase(res.purchases[i]);
          }
        }
        this.loadSuggestions(Purchase.getSupplierNames(this.parser.purchases));
      },
      (err: any) => {
        alert("Erro ao buscar boletos existentes");
        console.error(err);
      }
    );
  }
  checkIfIncomesExist() {
    let params = {
      incomes: Income.arrayExistsParams(this.parser.incomes)
    }
    this.api.req('incomes', params, {collection: 'exists'}, 'post').subscribe(
      (res: {incomes: Income[]}) => {
        for(let i = 0; i < this.parser.incomes.length; i++) {
          if(res.incomes[i] && res.incomes[i].id > 0) {
            this.parser.incomes[i] = new Income(res.incomes[i]);
          }
        }
      },
      (err: any) => {
        alert("Erro ao buscar receitas existentes");
        console.error(err);
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

  loadSuggestions(supplierNames: string[]) {
    this.api.show('tags', 'suggestions', {
      supplier_names: supplierNames
    }).subscribe(
      (res: {[supplierName: string]: Tag[]}) => {
        for(let supplierName in res) {
          this.suggestions[supplierName] = res[supplierName];
        }
        for(let boleto of this.parser.boletos) {
          let suggestedTags: Tag[] = res[boleto.supplier_name];
          if(suggestedTags) {
            boleto.auxTags = Utils.clone(suggestedTags);
          }
        }
        for(let purchase of this.parser.purchases) {
          let suggestedTags: Tag[] = res[purchase.supplier_name];
          if(suggestedTags) {
            purchase.tags = Utils.clone(suggestedTags);
            purchase.aux_tags = Utils.clone(suggestedTags);
          }
        }
      }
    );
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

    return new Promise((resolve, reject) => {
      this.api.indexAll('tags').subscribe(
        (res: any) => {
          this._addToAvailableTags(res.tags);
          resolve(res.tags);
        },
        (err: any) => {
          console.log(err);
          reject(err);
        }
      );
    });
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
