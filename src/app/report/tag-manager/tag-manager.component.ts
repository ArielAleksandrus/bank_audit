import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faPen,
  faCodeMerge,
  faFloppyDisk,
  faXmark,
  faCircleExclamation
} from '@fortawesome/free-solid-svg-icons';

import { Tag } from '../../shared/models/tag';
import { Purchase } from '../../shared/models/purchase';
import { ApiService } from '../../shared/services/api.service';
import { PurchaseComponent } from '../../balance/purchase/purchase.component';

@Component({
  selector: 'app-tag-manager',
  imports: [CommonModule, FormsModule, FaIconComponent, PurchaseComponent],
  templateUrl: './tag-manager.component.html',
  styleUrl: './tag-manager.component.scss'
})
export class TagManagerComponent {
  tags = input.required<Tag[]>();
  // emitted after a rename, merge, or a purchase edit/destroy, so the
  // parent can reload the list (e.g. to refresh purchase counts)
  changed = output<void>();

  penIcon = faPen;
  mergeIcon = faCodeMerge;
  saveIcon = faFloppyDisk;
  cancelIcon = faXmark;
  alertIcon = faCircleExclamation;

  editingId: number | null = null;
  editingName: string = '';
  savingRename: boolean = false;
  renameError: string = '';

  mergingId: number | null = null;
  mergeTargetId: number | null = null;
  savingMerge: boolean = false;
  mergeError: string = '';

  expandedTagId: number | null = null;
  expandedPurchases: Purchase[] = [];
  expandedPage: number = 1;
  expandedTotal: number = 0;
  expandedLoading: boolean = false;

  constructor(private api: ApiService) { }

  get expandedPageCount(): number {
    return Math.max(1, Math.ceil(this.expandedTotal / 5));
  }

  isExpanded(tag: Tag): boolean {
    return this.expandedTagId === tag.id;
  }

  toggleExpand(tag: Tag) {
    if(this.isExpanded(tag)) {
      this.expandedTagId = null;
      return;
    }

    this.expandedTagId = tag.id;
    this.expandedPage = 1;
    this._loadExpandedPurchases(tag);
  }

  goToExpandedPage(tag: Tag, page: number) {
    this.expandedPage = Math.min(this.expandedPageCount, Math.max(1, page));
    this._loadExpandedPurchases(tag);
  }

  onExpandedPurchasesChanged(tag: Tag) {
    this._loadExpandedPurchases(tag);
    this.changed.emit();
  }

  private _loadExpandedPurchases(tag: Tag) {
    this.expandedLoading = true;
    tag.loadPurchases(this.api, this.expandedPage).then(res => {
      this.expandedLoading = false;
      this.expandedPurchases = res.purchases;
      this.expandedTotal = res.total;
    }).catch(() => {
      this.expandedLoading = false;
    });
  }

  otherTags(tag: Tag): Tag[] {
    return this.tags().filter(t => t.id !== tag.id);
  }

  startRename(tag: Tag) {
    this.cancelMerge();
    this.editingId = tag.id;
    this.editingName = tag.name;
    this.renameError = '';
  }
  cancelRename() {
    this.editingId = null;
    this.renameError = '';
  }
  saveRename(tag: Tag) {
    const name = this.editingName.trim();
    if(!name) {
      this.renameError = 'Informe um nome';
      return;
    }
    if(name === tag.name) {
      this.editingId = null;
      return;
    }

    this.savingRename = true;
    tag.rename(this.api, name).then(() => {
      this.savingRename = false;
      this.editingId = null;
      this.changed.emit();
    }).catch((err: any) => {
      this.savingRename = false;
      this.renameError = err?.status === 422 ? 'Já existe uma tag com este nome' : 'Não foi possível renomear a tag';
    });
  }

  startMerge(tag: Tag) {
    this.cancelRename();
    this.mergingId = tag.id;
    this.mergeTargetId = null;
    this.mergeError = '';
  }
  cancelMerge() {
    this.mergingId = null;
    this.mergeError = '';
  }
  confirmMerge(tag: Tag) {
    const target = this.otherTags(tag).find(t => t.id === this.mergeTargetId);
    if(!target) {
      this.mergeError = 'Selecione uma tag de destino';
      return;
    }

    const confirmed = confirm(`Mesclar "${tag.name}" em "${target.name}"? Todas as compras com "${tag.name}" passarão a usar "${target.name}", e "${tag.name}" será removida. Essa ação não pode ser desfeita.`);
    if(!confirmed) {
      return;
    }

    this.savingMerge = true;
    tag.mergeInto(this.api, target).then(() => {
      this.savingMerge = false;
      this.mergingId = null;
      if(this.expandedTagId === tag.id) {
        this.expandedTagId = null;
      }
      this.changed.emit();
    }).catch(() => {
      this.savingMerge = false;
      this.mergeError = 'Não foi possível mesclar as tags';
    });
  }
}
