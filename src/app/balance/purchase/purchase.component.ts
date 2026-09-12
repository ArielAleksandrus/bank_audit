import { Component, model, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgSelectComponent } from '@ng-select/ng-select';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

//import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { Purchase, PAYMENT_TRANSLATION  } from '../../shared/models/purchase';
import { Tag } from '../../shared/models/tag';
import { Supplier } from '../../shared/models/supplier';

import { Utils } from '../../shared/helpers/utils';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-purchase',
  imports: [CommonModule, FormsModule, NgbPopoverModule, NgSelectComponent],
  providers: [/*provideNgxMask()*/ DatePipe, CurrencyPipe],
  templateUrl: './purchase.component.html',
  styleUrl: './purchase.component.scss'
})
export class PurchaseComponent {
  purchases = model.required<Purchase[]>();
  tags: Tag[] = [];
  suppliers: Supplier[] = [];
  onChange = output<{mode: 'create'|'edit'|'destroy', purchase: Purchase}>();
  collapse = input<boolean>();
  canSave = input<boolean>();
  canDestroy = input<boolean>();
  sending: boolean = false;
  printMode: boolean = false;

  collapsed?: boolean;

  selected?: Purchase;

  propagate: boolean = true;
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags da despesa serão copiadas para todas as despesas deste fornecedor";

  paymentTranslation = PAYMENT_TRANSLATION;

  referrals: string[] = [];

  filtering: boolean = false;
  filters: {
    bank_names: string[],
    payment_types: string[],
    value_min: number|null,
    value_max: number|null
  } = {
    bank_names: [],
    payment_types: [],
    value_min: null,
    value_max: null
  };
  availableBanks: string[] = [];
  availablePaymentTypes: string[] = [];

  total: number = 0;
  delayAFTimeout: any = null;

  page = 1;
  pageSize = 50;
  pageSizes = [25, 50, 100];
  visiblePurchases: Purchase[] = [];
  pagedPurchases: Purchase[] = [];
  editing: {purchase: Purchase, field: 'supplier'|'referral'|'tags'|'info'}|null = null;

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
    
    Purchase.loadReferrals(this.api).then((res: string[]) => {
      this.referrals = res;
    });
    Tag.loadTags(this.api).then((res: Tag[]) => {
      this.tags = Tag.fromJsonArray(res);
    });
    Supplier.loadSuppliers(this.api).then((res: Supplier[]) => {
      this.suppliers = Supplier.fromJsonArray(res);
    });
  }
  trackByPurchase = (_index: number, purchase: Purchase) => purchase.id ?? _index;
  get pageCount(): number {
    return Math.max(1, Math.ceil(this.visiblePurchases.length / this.pageSize));
  }
  get displayedPurchases(): Purchase[] {
    return this.printMode ? this.visiblePurchases : this.pagedPurchases;
  }
  startEdit(purchase: Purchase, field: 'supplier'|'referral'|'tags'|'info') {
    this.editing = {purchase, field};
  }
  isEditing(purchase: Purchase, field: 'supplier'|'referral'|'tags'|'info'): boolean {
    return this.editing?.purchase === purchase && this.editing.field === field;
  }
  stopEdit() {
    this.editing = null;
  }
  tagNames(purchase: Purchase): string {
    const names = (purchase.tags || []).map(tag => tag.name).filter(Boolean);
    return names.length ? names.join(', ') : '—';
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
    this.availablePaymentTypes = [];
    let objs = this.purchases();
    for(let obj of objs) {
      if(!!obj.bank_name)
        Utils.pushIfNotExists(this.availableBanks, obj.bank_name);
      if(!!obj.payment_type)
        Utils.pushIfNotExists(this.availablePaymentTypes, obj.payment_type);
    }
  }
  changeFilter(field: 'bank_names'|'payment_types'|'value_min'|'value_max', value: any) {
    //@ts-ignore
    this.filters[field] = value;

    if((field == "value_min" || field == "value_max") && value == "")
      value = null;

    this.page = 1;
    this.applyFilter();
  }
  applyFilter() {
    let objs = this.purchases();
    let filters = this.filters;

    let bankNames = (filters.bank_names && filters.bank_names.length > 0) ? filters.bank_names : this.availableBanks;
    let paymentTypes = (filters.payment_types && filters.payment_types.length > 0) ? filters.payment_types : this.availablePaymentTypes;

    for(let obj of objs) {
      if(bankNames.indexOf(obj.bank_name) == -1 ||
          paymentTypes.indexOf(obj.payment_type) == -1 ||
          (filters.value_min ? Number(obj.total) < Number(filters.value_min) : false) ||
          (filters.value_max ? Number(obj.total) > Number(filters.value_max) : false)) {
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
    let objs = this.purchases();
    for(let obj of objs) {
      obj.hidden = false;
    }
    this.page = 1;
    this._refreshView();
  }

  remove(obj: Purchase) {
    let objs = this.purchases();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      if(this.canDestroy()) {
        this.destroy(obj).then(res => {
          objs.splice(idx, 1);
          this.purchases.set(objs);
          this.onChange.emit({mode: 'destroy', purchase: obj});
          this._refreshView();
        });
      } else {
        objs.splice(idx, 1);
        this.purchases.set(objs);
        this.onChange.emit({mode: 'destroy', purchase: obj});
      }
      this._refreshView();
    }
  }
  add(obj: Purchase) {
    let objs = this.purchases();
    objs.push(obj);
    this.purchases.set(objs);
    this._refreshView();
    this.onChange.emit({mode: 'create', purchase: obj});
  }
  edit(obj: Purchase) {
    let objs = this.purchases();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.purchases.set(objs);
      this.onChange.emit({mode: 'edit', purchase: obj});
      this._refreshView();
    }
    this.selected = undefined;
  }
  destroy(obj: Purchase): Promise<boolean> {
    return new Promise((resolve, reject) => {  
      if(!(obj.id > 0)) {
        resolve(false);
      }
      this.api.destroy('purchases', obj.id).subscribe(
        res => {
          resolve(true);
          this._refreshView();
        },
        err => {
          console.error("Error removing purchase: ", err);
          reject(err);
        }
      );
    });
  }

  save() {
    if(!this.canSave()) {
      console.error("PurchaseComponent: Not allowed to save");
      return;
    }

    this.sending = true;
    Purchase.sendArray(this.api, this.purchases()).then(res => {
      // Rows the server reclassified as a same-titularidade transfer (see
      // payment_type "movimentacao_entre_contas") no longer belong here.
      this.purchases.set(res.filter(purchase => purchase.auxStatus != 'converted'));
      this.sending = false;
      alert("Compras salvas");
    }).catch(err => {
      console.error("PurchaseComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar recebimentos");
    });
  }
  export() {
    // Builds the PDF straight from visiblePurchases (every filtered row, not
    // just the current page) instead of scraping the rendered table's DOM -
    // the table only ever renders the current page, so scraping it silently
    // exported just that page once pagination was added.
    const doc = new jsPDF();
    const head = [['DATA', 'BANCO', 'FORNECEDOR', 'TOTAL', 'TIPO', 'TAGS', 'INF. ADIC.']];
    const body = this.visiblePurchases.map(purchase => [
      this.datePipe.transform(purchase.purchase_date, 'dd/MM/YYYY') || '',
      purchase.bank_name || '',
      purchase.supplier_name || '',
      this.currencyPipe.transform(purchase.total, 'BRL') || '',
      this.paymentTranslation[purchase.payment_type] || purchase.payment_type || '',
      this.tagNames(purchase),
      purchase.additional_info || ''
    ]);
    autoTable(doc, { head, body });
    doc.save("despesas.pdf");
  }

  open(obj?: Purchase) {
    if(!obj)
      obj = new Purchase({});

    this.selected = obj;
  }

  tagChanged(obj: Purchase, tags: Tag[]) {
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
      this.onChange.emit({mode: 'edit', purchase: obj});
    }
  }
  private _propagateTags(supplierName: string, tags: Tag[]): number {
    let changed: number = 0;

    let objs = this.purchases();

    for(let i = 0; i < objs.length; i++) {
      let obj = objs[i];
      if(obj.supplier_name == supplierName) {
        obj.setTags(tags);
        this.onChange.emit({mode: 'edit', purchase: obj});
        changed++;
      }
    }

    return changed;
  }
  private _recalculate() {
    this.total = Purchase.getTotal(this.purchases());
  }
  private _refreshView() {
    this._recalculate();
    this.visiblePurchases = this._applySort(this.purchases().filter(purchase => !purchase.hidden));
    if(this.page > this.pageCount)
      this.page = this.pageCount;
    this._slicePage();
  }
  private _slicePage() {
    const start = (this.page - 1) * this.pageSize;
    this.pagedPurchases = this.visiblePurchases.slice(start, start + this.pageSize);
  }
  private _applySort(items: Purchase[]): Purchase[] {
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