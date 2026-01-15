import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';

import { Income } from '../../shared/models/income';
import { ApiService } from '../../shared/services/api.service';
import { Utils } from '../../shared/helpers/utils';

@Component({
  selector: 'app-income',
  imports: [CommonModule, FormsModule, FontAwesomeModule,
            NgbCollapseModule, NgbPopoverModule,
            NgSelectComponent
            //NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent
          ],
  templateUrl: './income.component.html',
  styleUrl: './income.component.scss'
})
export class IncomeComponent {
  incomes = model.required<Income[]>();
  onChange = output<{mode: 'create'|'edit'|'destroy', income: Income}>();
  collapse = input<boolean>();
  mode = input<'parser'|'manual'>('manual');
  canSave = input<boolean>();
  canDestroy = input<boolean>();
  sending: boolean = false;
  printMode: boolean = false;

  collapsed?: boolean;

  selected?: Income;

  filtering: boolean = false;
  filters: {
    bank_names: string[],
    income_types: string[],
    value_min: number|null,
    value_max: number|null
  } = {
    bank_names: [],
    income_types: [],
    value_min: null,
    value_max: null
  };
  availableBanks: string[] = [];
  availableIncomeTypes: string[] = [];

  total: number = 0;

  constructor(private api: ApiService) {
  }
  ngOnInit() {
    this.collapsed = this.collapse();
    this.prepareFilter();
    this._recalculate();
  }

  prepareFilter() {
    this.availableBanks = [];
    this.availableIncomeTypes = [];
    let objs = this.incomes();
    for(let obj of objs) {
      if(!!obj.bank_name)
        Utils.pushIfNotExists(this.availableBanks, obj.bank_name);
      if(!!obj.income_type)
        Utils.pushIfNotExists(this.availableIncomeTypes, obj.income_type);
    }
  }
  changeFilter(field: 'bank_names'|'income_types'|'value_min'|'value_max', value: any) {
    //@ts-ignore
    this.filters[field] = value;

    if((field == "value_min" || field == "value_max") && value == "")
      value = null;

    this.applyFilter();
  }
  applyFilter() {
    let objs = this.incomes();
    let filters = this.filters;

    let bankNames = (filters.bank_names && filters.bank_names.length > 0) ? filters.bank_names : this.availableBanks;
    let incomeTypes = (filters.income_types && filters.income_types.length > 0) ? filters.income_types : this.availableIncomeTypes;

    for(let obj of objs) {
      if(bankNames.indexOf(obj.bank_name) == -1 ||
          incomeTypes.indexOf(obj.income_type) == -1 ||
          (filters.value_min ? Number(obj.value) < Number(filters.value_min) : false) ||
          (filters.value_max ? Number(obj.value) > Number(filters.value_max) : false)) {
        obj.hidden = true;
      } else {
        obj.hidden = false;
      }
    }
    this._recalculate();
  }
  clearHidden() {
    let objs = this.incomes();
    for(let obj of objs) {
      obj.hidden = false;
    }
    this._recalculate();
  }

  save() {
    if(!this.canSave()) {
      console.error("IncomeComponent: Not allowed to save");
      return;
    }

    this.sending = true;
    Income.sendArray(this.api, this.incomes()).then(res => {
      this.incomes.set(res);
      this.sending = false;
      alert("Recebimentos salvos");
    }).catch(err => {
      console.error("IncomeComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar recebimentos");
    });
  }
  export() {
    this.printMode = true;
    this.collapsed = false;
    setTimeout(() => {
      const doc = new jsPDF();
      autoTable(doc, { html: '#incomeTable' });
      doc.save("entradas.pdf");
      setTimeout(() => {
        this.printMode = false;
      }, 1000);
    }, 1000);
  }

  remove(obj: Income) {
    let objs = this.incomes();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      if(this.canDestroy()) {
        this.destroy(obj).then(res => {
          objs.splice(idx, 1);
          this.incomes.set(objs);
          this.onChange.emit({mode: 'destroy', income: obj});
        });
      } else {
        objs.splice(idx, 1);
        this.incomes.set(objs);
        this.onChange.emit({mode: 'destroy', income: obj});
      }
      this._recalculate();
    }
  }
  add(obj: Income) {
    let objs = this.incomes();
    objs.push(obj);
    this.incomes.set(objs);
    this.onChange.emit({mode: 'create', income: obj});
    this._recalculate();
  }
  edit(obj: Income) {
    let objs = this.incomes();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.incomes.set(objs);
      this._recalculate();
      this.onChange.emit({mode: 'edit', income: obj});
    }
    this.selected = undefined;
  }
  destroy(obj: Income): Promise<boolean> {
    return new Promise((resolve, reject) => {  
      if(!(obj.id > 0)) {
        resolve(false);
      }
      this.api.destroy('incomes', obj.id).subscribe(
        (res: any) => {
          resolve(true);
          this._recalculate();
        },
        (err: any) => {
          console.error("Error removing income: ", err);
          reject(err);
        }
      );
    });
  }

  open(obj?: Income) {
    if(!obj)
      obj = new Income({});

    this.selected = obj;
  }


  private _recalculate() {
    this.total = Income.getTotal(this.incomes());
  }
}
