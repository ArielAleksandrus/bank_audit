import { Component, model, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgSelectComponent } from '@ng-select/ng-select';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { Boleto } from '../../shared/models/boleto';
import { Tag } from '../../shared/models/tag';
import { Supplier } from '../../shared/models/supplier';

import { Utils } from '../../shared/helpers/utils';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-boleto',
  imports: [CommonModule, FormsModule, NgbPopoverModule, NgSelectComponent],
  providers: [DatePipe, CurrencyPipe],
  templateUrl: './boleto.component.html',
  styleUrl: './boleto.component.scss'
})
export class BoletoComponent {
  boletos = model.required<Boleto[]>();
  tags: Tag[] = [];
  suppliers: Supplier[] = [];

  onChange = output<{mode: 'create'|'edit'|'destroy', boleto: Boleto}>();
  collapse = input<boolean>();
  canSave = input<boolean>();
  canDestroy = input<boolean>();
  sending: boolean = false;
  printMode: boolean = false;

  collapsed?: boolean;

  selected?: Boleto;

  propagate: boolean = true;
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags do boleto serão copiadas para todos os boletos deste fornecedor";

  total: number = 0;

  filtering: boolean = false;
  filters: {
    bank_names: string[],
    tags: string[],
    suppliers: string[],
    value_min: number|null,
    value_max: number|null
  } = {
    bank_names: [],
    tags: [],
    suppliers: [],
    value_min: null,
    value_max: null
  };
  availableBanks: string[] = [];
  availableTags: string[] = [];
  availableSuppliers: string[] = [];

  delayAFTimeout: any = null;

  page = 1;
  pageSize = 50;
  pageSizes = [25, 50, 100];
  visibleBoletos: Boleto[] = [];
  pagedBoletos: Boleto[] = [];
  editing: {boleto: Boleto, field: 'supplier'|'tags'}|null = null;

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

    Tag.loadTags(this.api).then((res: Tag[]) => {
      this.tags = Tag.fromJsonArray(res);
    });
    Supplier.loadSuppliers(this.api).then((res: Supplier[]) => {
      this.suppliers = Supplier.fromJsonArray(res);
    });
  }
  trackByBoleto = (_index: number, boleto: Boleto) => boleto.id ?? _index;
  tagNames(boleto: Boleto): string {
    const names = (boleto.auxTags || []).map(tag => tag.name).filter(Boolean);
    return names.length ? names.join(', ') : '—';
  }
  get pageCount(): number {
    return Math.max(1, Math.ceil(this.visibleBoletos.length / this.pageSize));
  }
  get displayedBoletos(): Boleto[] {
    return this.printMode ? this.visibleBoletos : this.pagedBoletos;
  }
  startEdit(boleto: Boleto, field: 'supplier'|'tags') {
    this.editing = {boleto, field};
  }
  isEditing(boleto: Boleto, field: 'supplier'|'tags'): boolean {
    return this.editing?.boleto === boleto && this.editing.field === field;
  }
  stopEdit() {
    this.editing = null;
  }
  goToPage(page: number) {
    this.page = Math.min(this.pageCount, Math.max(1, page));
    this.stopEdit();
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
    this.availableTags = [];
    let objs = this.boletos();
    for(let obj of objs) {
      if(!!obj.bank_name)
        Utils.pushIfNotExists(this.availableBanks, obj.bank_name);
      if(!!obj.auxTags) {
        for(let tag of obj.auxTags)
          Utils.pushIfNotExists(this.availableTags, tag.name);
      }
      if(!!obj.supplier_name) {
        Utils.pushIfNotExists(this.availableSuppliers, obj.supplier_name);
      }
    }
  }
  changeFilter(field: 'bank_names'|'tags'|'supplier'|'value_min'|'value_max', value: any) {
    //@ts-ignore
    this.filters[field] = value;

    if((field == "value_min" || field == "value_max") && value == "")
      value = null;

    this.page = 1;
    this.applyFilter();
  }
  applyFilter() {
    let objs = this.boletos();
    let filters = this.filters;

    let bankNames = (filters.bank_names && filters.bank_names.length > 0) ? filters.bank_names : this.availableBanks;
    let suppliers = (filters.suppliers && filters.suppliers.length > 0) ? filters.suppliers : this.availableSuppliers;
    let tags = (filters.tags && filters.tags.length > 0) ? filters.tags : this.availableTags;

    for(let obj of objs) {
      if(bankNames.indexOf(obj.bank_name) == -1 ||
          suppliers.indexOf(obj.supplier_name) == -1 ||
          Boleto.hasTag(obj, tags, 'or') == false ||
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

  remove(obj: Boleto) {
    let objs = this.boletos();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      if(this.canDestroy()) {
        this.destroy(obj).then(res => {
          objs.splice(idx, 1);
          this.boletos.set(objs);
          this.onChange.emit({mode: 'destroy', boleto: obj});
          this._refreshView();
        });
      } else {
        objs.splice(idx, 1);
        this.boletos.set(objs);
        this.onChange.emit({mode: 'destroy', boleto: obj});
      }
      this._refreshView();
    }
  }
  add(obj: Boleto) {
    let objs = this.boletos();
    objs.push(obj);
    this.boletos.set(objs);
    this._refreshView();
    this.onChange.emit({mode: 'create', boleto: obj});
  }
  edit(obj: Boleto) {
    let objs = this.boletos();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.boletos.set(objs);
      this.onChange.emit({mode: 'edit', boleto: obj});
      this._refreshView();
    }
    this.selected = undefined;
  }

  destroy(obj: Boleto): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if(!(obj.id > 0)) {
        resolve(false);
      }
      this.api.destroy('boletos', obj.id).subscribe(
        (res: any) => {
          resolve(true);
          this._refreshView();
        },
        (err: any) => {
          console.error("Error removing boleto: ", err);
          reject(err);
        }
      );
    });
  }

  save() {
    if(!this.canSave()) {
      console.error("BoletoComponent: Not allowed to save");
      return;
    }

    this.sending = true;
    Boleto.sendArray(this.api, this.boletos()).then(res => {
      this.boletos.set(res);
      this._refreshView();
      this.sending = false;
      alert("Boletos salvos");
    }).catch(err => {
      console.error("BoletoComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar boletos");
    });
  }

  export() {
    // Builds the PDF straight from visibleBoletos (every filtered row, not
    // just the current page) instead of scraping the rendered table's DOM -
    // the table only ever renders the current page, so scraping it silently
    // exported just that page once pagination was added.
    const doc = new jsPDF();
    const head = [['BANCO', 'PGTO.', 'VENC.', 'FORNECEDOR', 'VALOR', 'PARCELA', 'TAGS']];
    const body = this.visibleBoletos.map(boleto => [
      boleto.bank_name || '',
      this.datePipe.transform(boleto.payment_date, 'dd/MM/YYYY') || '',
      this.datePipe.transform(boleto.expiration_date, 'dd/MM/YYYY') || '',
      boleto.supplier_name || '',
      this.currencyPipe.transform(boleto.value, 'BRL') || '',
      boleto.installments || '',
      this.tagNames(boleto)
    ]);
    autoTable(doc, { head, body });
    doc.save("boletos.pdf");
  }

  open(obj?: Boleto) {
    if(!obj)
      obj = new Boleto({});

    this.selected = obj;
  }

  tagChanged(obj: Boleto, tags: Tag[]) {
    let added = false;
    for(let tag of tags) {
      if(tag.id == null) { // tag was not created
        tag.id = -(new Date().getTime()); // add a negative id so we can create it when user saves
        Utils.pushIfNotExists(this.tags, tag, 'name');
        added = true;
      }
    }
    // make ngselect reload tags so the user can see in the dropdown selection
    if(added) this.tags = Utils.clone(this.tags);
    
    obj.setTags(tags);

    if(this.propagate)
      this._propagateTags(obj.supplier_name, tags);
    else {
      this.onChange.emit({mode: 'edit', boleto: obj});
    }
  }
  private _propagateTags(supplierName: string, tags: Tag[]): number {
    let changed: number = 0;

    let objs = this.boletos();

    for(let i = 0; i < objs.length; i++) {
      let obj = objs[i];
      if(obj.supplier_name == supplierName) {
        obj.setTags(tags);
        this.onChange.emit({mode: 'edit', boleto: obj});
        changed++;
      }
    }

    return changed;
  }

  private _recalculate() {
    this.total = Boleto.getTotal(this.boletos());
  }
  private _refreshView() {
    this._recalculate();
    this.visibleBoletos = this._applySort(this.boletos().filter(boleto => !boleto.hidden));
    if(this.page > this.pageCount)
      this.page = this.pageCount;
    this._slicePage();
  }
  private _slicePage() {
    const start = (this.page - 1) * this.pageSize;
    this.pagedBoletos = this.visibleBoletos.slice(start, start + this.pageSize);
  }
  private _applySort(items: Boleto[]): Boleto[] {
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