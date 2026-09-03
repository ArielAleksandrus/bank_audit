import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowTrendDown,
  faArrowTrendUp,
  faFileInvoiceDollar,
  faPen,
  faTrash,
  faCheck,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

import { ApiService } from '../../shared/services/api.service';
import { Purchase } from '../../shared/models/purchase';
import { Income } from '../../shared/models/income';
import { Boleto } from '../../shared/models/boleto';

type ItemType = 'purchase'|'income'|'boleto';

interface RecentItem {
  type: ItemType;
  id: number;
  created_at: string;
  title: string;
  subtitle: string;
  date: string;
  value: number;
}

interface EditForm {
  type: ItemType;
  id: number;
  label: string; // supplier_name (purchase) / origin (income) - not used for boleto
  bank_name: string;
  value: string|number;
  date: string;
}

const RESOURCE_PLURAL: {[key in ItemType]: string} = {
  purchase: 'purchases',
  income: 'incomes',
  boleto: 'boletos'
};

@Component({
  selector: 'app-recent-insertions',
  imports: [CommonModule, FormsModule, FaIconComponent],
  templateUrl: './recent-insertions.component.html',
  styleUrl: './recent-insertions.component.scss'
})
export class RecentInsertionsComponent {
  @Input() fetchLimit: number = 30;

  loading: boolean = true;
  items: RecentItem[] = [];

  page: number = 1;
  pageSize: number = 10;
  pageSizes = [10, 25, 50];

  editing: EditForm|null = null;
  saving: boolean = false;
  removingId: string|null = null;

  purchaseIcon = faArrowTrendDown;
  incomeIcon = faArrowTrendUp;
  boletoIcon = faFileInvoiceDollar;
  editIcon = faPen;
  removeIcon = faTrash;
  saveIcon = faCheck;
  cancelIcon = faXmark;

  private _purchases: Purchase[] = [];
  private _incomes: Income[] = [];
  private _boletos: Boleto[] = [];
  private _loadedCount: number = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this._loadedCount = 0;

    this.api.index('purchases', {o: {created_at: 'desc'}, per_page: this.fetchLimit}).subscribe(
      (res: {purchases: any[]}) => {
        this._purchases = Purchase.fromJsonArray(res.purchases || []);
        this._onPartLoaded();
      },
      () => this._onPartLoaded()
    );
    this.api.index('incomes', {o: {created_at: 'desc'}, per_page: this.fetchLimit}).subscribe(
      (res: {incomes: any[]}) => {
        this._incomes = Income.fromJsonArray(res.incomes || []);
        this._onPartLoaded();
      },
      () => this._onPartLoaded()
    );
    this.api.index('boletos', {o: {created_at: 'desc'}, per_page: this.fetchLimit}).subscribe(
      (res: {boletos: any[]}) => {
        this._boletos = Boleto.fromJsonArray(res.boletos || []);
        this._onPartLoaded();
      },
      () => this._onPartLoaded()
    );
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }
  get pagedItems(): RecentItem[] {
    const start = (this.page - 1) * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }
  goToPage(page: number) {
    this.page = Math.min(this.pageCount, Math.max(1, page));
  }
  onPageSizeChange() {
    this.page = 1;
  }

  typeLabel(type: ItemType): string {
    if(type == 'purchase') return 'Saída';
    if(type == 'income') return 'Entrada';
    return 'Boleto';
  }
  typeIcon(type: ItemType) {
    if(type == 'purchase') return this.purchaseIcon;
    if(type == 'income') return this.incomeIcon;
    return this.boletoIcon;
  }

  isEditing(item: RecentItem): boolean {
    return this.editing?.type === item.type && this.editing?.id === item.id;
  }

  startEdit(item: RecentItem) {
    if(item.type == 'purchase') {
      const p = this._purchases.find(el => el.id === item.id);
      this.editing = { type: 'purchase', id: item.id, label: p?.supplier_name || '', bank_name: p?.bank_name || '', value: p?.base_value ?? '', date: p?.purchase_date || '' };
    } else if(item.type == 'income') {
      const i = this._incomes.find(el => el.id === item.id);
      this.editing = { type: 'income', id: item.id, label: i?.origin || '', bank_name: i?.bank_name || '', value: i?.value ?? '', date: i?.date_received || '' };
    } else {
      const b = this._boletos.find(el => el.id === item.id);
      this.editing = { type: 'boleto', id: item.id, label: '', bank_name: b?.bank_name || '', value: b?.value ?? '', date: b?.expiration_date || '' };
    }
  }
  cancelEdit() {
    this.editing = null;
  }

  saveEdit() {
    if(!this.editing || this.saving)
      return;

    const form = this.editing;
    const resource = RESOURCE_PLURAL[form.type];
    let payload: any;

    if(form.type == 'purchase') {
      payload = { purchase: { supplier_name: form.label, bank_name: form.bank_name, base_value: form.value, purchase_date: form.date } };
    } else if(form.type == 'income') {
      payload = { income: { origin: form.label, bank_name: form.bank_name, value: form.value, date_received: form.date } };
    } else {
      payload = { boleto: { bank_name: form.bank_name, value: form.value, expiration_date: form.date } };
    }

    this.saving = true;
    this.api.update(resource, form.id, payload).subscribe(
      (res: any) => {
        this.saving = false;
        this.editing = null;
        this._replaceRaw(form.type, res);
        this._rebuild();
      },
      (err: any) => {
        this.saving = false;
        alert('Erro ao salvar as alterações');
        console.error(err);
      }
    );
  }

  remove(item: RecentItem) {
    const key = `${item.type}-${item.id}`;
    if(this.removingId)
      return;
    if(!confirm(`Remover este lançamento (${this.typeLabel(item.type)})?`))
      return;

    this.removingId = key;
    this.api.destroy(RESOURCE_PLURAL[item.type], item.id).subscribe(
      () => {
        this.removingId = null;
        this._removeRaw(item.type, item.id);
        this._rebuild();
      },
      (err: any) => {
        this.removingId = null;
        alert('Erro ao remover o lançamento');
        console.error(err);
      }
    );
  }

  private _onPartLoaded() {
    this._loadedCount++;
    if(this._loadedCount >= 3) {
      this.loading = false;
    }
    this._rebuild();
  }

  private _rebuild() {
    const items: RecentItem[] = [];
    for(let p of this._purchases) {
      items.push({
        type: 'purchase', id: p.id, created_at: p.created_at,
        title: p.supplier_name || '—', subtitle: p.bank_name || '',
        date: p.purchase_date, value: Number(p.total ?? p.base_value) || 0
      });
    }
    for(let i of this._incomes) {
      items.push({
        type: 'income', id: i.id, created_at: i.created_at,
        title: i.origin || '—', subtitle: i.bank_name || '',
        date: i.date_received, value: Number(i.value) || 0
      });
    }
    for(let b of this._boletos) {
      items.push({
        type: 'boleto', id: b.id, created_at: b.created_at,
        title: b.supplier_name || '—', subtitle: `${b.bank_name || ''}${b.installments ? ' · ' + b.installments : ''}`,
        date: b.expiration_date, value: Number(b.value) || 0
      });
    }
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    this.items = items;
    if(this.page > this.pageCount)
      this.page = this.pageCount;
  }

  private _replaceRaw(type: ItemType, res: any) {
    if(type == 'purchase') {
      const idx = this._purchases.findIndex(p => p.id === res.id);
      if(idx > -1) this._purchases[idx] = new Purchase(res);
    } else if(type == 'income') {
      const idx = this._incomes.findIndex(i => i.id === res.id);
      if(idx > -1) this._incomes[idx] = new Income(res);
    } else {
      const idx = this._boletos.findIndex(b => b.id === res.id);
      if(idx > -1) this._boletos[idx] = new Boleto(res);
    }
  }
  private _removeRaw(type: ItemType, id: number) {
    if(type == 'purchase') {
      this._purchases = this._purchases.filter(p => p.id !== id);
    } else if(type == 'income') {
      this._incomes = this._incomes.filter(i => i.id !== id);
    } else {
      this._boletos = this._boletos.filter(b => b.id !== id);
    }
  }
}
