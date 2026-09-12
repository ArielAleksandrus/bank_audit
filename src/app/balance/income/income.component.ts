import { Component, model, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgSelectComponent } from '@ng-select/ng-select';

import { Income } from '../../shared/models/income';
import { ApiService } from '../../shared/services/api.service';
import { Utils } from '../../shared/helpers/utils';

@Component({
  selector: 'app-income',
  imports: [CommonModule, FormsModule, NgSelectComponent],
  providers: [DatePipe, CurrencyPipe],
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
  delayAFTimeout: any = null;

  page = 1;
  pageSize = 50;
  pageSizes = [25, 50, 100];
  visibleIncomes: Income[] = [];
  pagedIncomes: Income[] = [];

  sortField: string | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  constructor(private api: ApiService,
              private datePipe: DatePipe,
              private currencyPipe: CurrencyPipe) {
  }
  ngOnInit() {
    this.collapsed = this.collapse();
    this.prepareFilter();
    this._refreshView();
  }
  trackByIncome = (_index: number, income: Income) => income.id ?? _index;
  get pageCount(): number {
    return Math.max(1, Math.ceil(this.visibleIncomes.length / this.pageSize));
  }
  get displayedIncomes(): Income[] {
    return this.printMode ? this.visibleIncomes : this.pagedIncomes;
  }
  goToPage(page: number) {
    this.page = Math.min(this.pageCount, Math.max(1, page));
    this._slicePage();
  }
  onPageSizeChange() {
    this.page = 1;
    this._slicePage();
  }
  sortBy(field: string) {
    if(this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.page = 1;
    this._refreshView();
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

    this.page = 1;
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
    this._refreshView();
  }
  delayApplyFilter() {
    if(this.delayAFTimeout) {
      clearTimeout(this.delayAFTimeout);
      this.delayAFTimeout = null;
    }
    this.delayAFTimeout = setTimeout(() => {
      this.applyFilter();
    }, 1000);
  }
  clearHidden() {
    let objs = this.incomes();
    for(let obj of objs) {
      obj.hidden = false;
    }
    this.page = 1;
    this._refreshView();
  }

  save() {
    if(!this.canSave()) {
      console.error("IncomeComponent: Not allowed to save");
      return;
    }

    this.sending = true;
    Income.sendArray(this.api, this.incomes()).then(res => {
      // Rows the server reclassified as a same-titularidade transfer (see
      // income_type "movimentacao_entre_contas") no longer belong here.
      this.incomes.set(res.filter(income => income.auxStatus != 'converted'));
      this._refreshView();
      this.sending = false;
      alert("Recebimentos salvos");
    }).catch(err => {
      console.error("IncomeComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar recebimentos");
    });
  }
  export() {
    // Builds the PDF straight from visibleIncomes (every filtered row, not
    // just the current page) instead of scraping the rendered table's DOM -
    // the table only ever renders the current page, so scraping it silently
    // exported just that page once pagination was added.
    const doc = new jsPDF();
    const head = [['BANCO', 'DATA', 'TIPO', 'ORIGEM', 'VALOR']];
    const body = this.visibleIncomes.map(income => [
      income.bank_name || '',
      this.datePipe.transform(income.date_received, 'dd/MM/YYYY') || '',
      income.income_type || '',
      income.origin || '',
      this.currencyPipe.transform(income.value, 'BRL') || ''
    ]);
    autoTable(doc, { head, body });
    doc.save("entradas.pdf");
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
          this._refreshView();
        });
      } else {
        objs.splice(idx, 1);
        this.incomes.set(objs);
        this.onChange.emit({mode: 'destroy', income: obj});
      }
      this._refreshView();
    }
  }
  add(obj: Income) {
    let objs = this.incomes();
    objs.push(obj);
    this.incomes.set(objs);
    this.onChange.emit({mode: 'create', income: obj});
    this._refreshView();
  }
  edit(obj: Income) {
    let objs = this.incomes();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.incomes.set(objs);
      this._refreshView();
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
          this._refreshView();
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
  private _refreshView() {
    this._recalculate();
    this.visibleIncomes = this._applySort(this.incomes().filter(income => !income.hidden));
    if(this.page > this.pageCount)
      this.page = this.pageCount;
    this._slicePage();
  }
  private _slicePage() {
    const start = (this.page - 1) * this.pageSize;
    this.pagedIncomes = this.visibleIncomes.slice(start, start + this.pageSize);
  }
  private _applySort(items: Income[]): Income[] {
    if(!this.sortField)
      return items;

    const field = this.sortField;
    const dir = this.sortDir === 'asc' ? 1 : -1;

    return [...items].sort((a: any, b: any) => {
      let av = a[field], bv = b[field];
      if(av == null && bv == null) return 0;
      if(av == null) return -1 * dir;
      if(bv == null) return 1 * dir;

      let an = Number(av), bn = Number(bv);
      if(av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn))
        return (an - bn) * dir;

      return String(av).localeCompare(String(bv)) * dir;
    });
  }
}
