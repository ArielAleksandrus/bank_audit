import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {pdf2array, Pdf2ArrayOptions, pdfjs} from "pdf2array";


//import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { IncomeSumComponent } from '../balance/income-sum/income-sum.component';
import { IncomeComponent } from '../balance/income/income.component';
import { BoletoComponent } from '../balance/boleto/boleto.component';
import { PurchaseComponent } from '../balance/purchase/purchase.component';

import * as XLSX from 'xlsx';

import { BalanceParser } from '../shared/parsers/balance-parser';
import { BrbParser } from '../shared/parsers/brb-parser';
import { SicoobParser } from '../shared/parsers/sicoob-parser';
import { SicrediParser } from '../shared/parsers/sicredi-parser';
import { StoneParser } from '../shared/parsers/stone-parser';

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
    //NgSelectComponent,
    NgbPopoverModule,
    FormsModule,
    IncomeSumComponent,
    IncomeComponent,
    BoletoComponent,
    PurchaseComponent
  ],
  templateUrl: './parser.component.html',
  styleUrl: './parser.component.scss'
})
export class ParserComponent {
  company: Company = <Company>{id: -1};

  selectedBank?: 'brb'|'sicoob'|'stone'|'sicredi';
  excelData: any[] = [];
  pdfData: any = {};
  parser: BalanceParser;

  suggestions: {[supplierName: string]: Tag[]} = {};

  sending: boolean = false;
  sendingCount: number = 0;

  constructor (private api: ApiService) {
    this.parser = new SicoobParser(); // pick any parser to begin with. user can change it later
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;
  }
  ngOnInit() {
    this._loadCompany();
    //TODO: replace token to user-defined token received via input and stored in localstorage
    this.api.setAuth({token: this.company.token});
  }

  bankChanged() {
    switch(this.selectedBank) {
    case("brb"): {
      this.parser = new BrbParser();
      break;
    }
    case("sicoob"): {
      this.parser = new SicoobParser();
      break;
    }
    case("sicredi"): {
      this.parser = new SicrediParser();
      break;
    }
    case("stone"): {
      this.parser = new StoneParser();
      break;
    }
    }
  }

  extratoFileChanged(evt: any) {
    const file: File = evt.target.files[0];
    let auxArr = file.name.split(".");
    let extension = auxArr[auxArr.length - 1];

    if(extension == "pdf") {
      this._useArrayBuffer(file, extension)
    } else {
      this._useFileReader(file, extension);
    }
  }

  loadExtrato(file: File, fileContent: any, extension: string) {
    switch(extension) {
    case("xls"): {
      this.loadExcel(fileContent);
      break;
    }
    case("xlsx"): {
      this.loadExcel(fileContent);
      break;
    }
    case("ofx"): {
      this.loadOFX(fileContent);
      break;
    }
    case("pdf"): {
      this.loadPDF(fileContent);
      break;
    }
    }

    this.checkIfBoletosExist();
    this.checkIfIncomesExist();
    this.checkIfPurchasesExist();
  }
  loadExcel(fileContent: any) {
    const workbook = XLSX.read(fileContent, { type: 'binary' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    this.excelData = XLSX.utils.sheet_to_json(worksheet, { raw: true });
    this.parser.parseExtrato(this.excelData, 'excel');
  }
  loadOFX(fileContent: any) {
    this.parser.parseExtrato([fileContent], 'ofx');
  }
  loadPDF(fileContent: any) {
    this.parser.parseExtrato(fileContent, 'pdf');
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

  changedPurchase(evt: {mode: 'create'|'edit'|'destroy', purchase: Purchase}) {
    if(evt.mode == 'destroy') {

    } else {
      //this.sendPurchase(evt.purchase);
    }
  }

  changedIncome(evt: {mode: 'create'|'edit'|'destroy', income: Income}) {
    this.parser.recalculateIncome();
    if(evt.mode == 'destroy') {
      this.removeIncome(evt.income);
    } else {
      //this.sendIncome(evt.income);
    }
  }
  removeIncome(income: Income) {
    if(income.id > 0) {
      this.api.destroy('incomes', income.id).subscribe(
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
      this.sendingCount -= this.parser.boletos.length;
      this.saveIncomes().then(res2 => {
        this.sendingCount -= this.parser.incomes.length;
        this.savePurchases().then(res3 => {
          this.sendingCount -= this.parser.purchases.length;
          this.sending = false;
        })
      })
    });
  }

  saveBoletos(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      Boleto.sendArray(this.api, this.parser.boletos).then(res => {
        this.parser.boletos = res;
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }
  saveIncomes(): Promise<boolean>  {
    return new Promise<boolean>((resolve, reject) => {
      Income.sendArray(this.api, this.parser.incomes).then(res => {
        this.parser.incomes = res;
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }

  savePurchases(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      Purchase.sendArray(this.api, this.parser.purchases).then(res => {
        this.parser.purchases = res;
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }

  checkIfBoletosExist() {
    Boleto.arrayExists(this.api, this.parser.boletos).then((boletos: Boleto[]) => {
      this.parser.boletos = boletos;
    });
  }
  checkIfPurchasesExist() {
    Purchase.arrayExists(this.api, this.parser.purchases).then((purchases: Purchase[]) => {
      this.parser.purchases = purchases;
    });
  }
  checkIfIncomesExist() {
    Income.arrayExists(this.api, this.parser.incomes).then((incomes: Income[]) => {
      this.parser.incomes = incomes;
    });
  }

  private _loadCompany() {
    let loaded = Company.loadCompany();
    if(loaded && loaded.token) {
      this.company = loaded;
    } else {
      location.href = '/login';
    }
  }


  private _useArrayBuffer(file: File, extension: string) {
    file.arrayBuffer().then(buffer => {
      pdf2array(buffer, {}).then((data: any) => {
        this.loadExtrato(file, data, extension);
      })
    })
  }
  private _useFileReader(file: File, extension: string) {
    const self = this;
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      self.loadExtrato(file, e.target.result, extension);
    }
    
    if(extension == "ofx")
      reader.readAsText(file);
    else
      reader.readAsBinaryString(file);
  }
}
