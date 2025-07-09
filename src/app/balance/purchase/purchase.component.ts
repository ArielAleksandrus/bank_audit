import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

//import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { Purchase, PAYMENT_TRANSLATION  } from '../../shared/models/purchase';
import { Tag } from '../../shared/models/tag';
import { Supplier } from '../../shared/models/supplier';

import { Utils } from '../../shared/helpers/utils';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-purchase',
  imports: [CommonModule, FormsModule, FontAwesomeModule,
            NgbCollapseModule, NgbPopoverModule,
            //NgxMaskDirective,
            NgSelectComponent
          ],
  providers: [/*provideNgxMask()*/],
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
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags do purchase serão copiadas para todos os purchases deste fornecedor";

  paymentTranslation = PAYMENT_TRANSLATION;

  referrals: string[] = [];

  constructor(private api: ApiService) {
  }
  ngOnInit() {
    this.collapsed = this.collapse();
    
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

  remove(obj: Purchase) {
    let objs = this.purchases();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      if(this.canDestroy()) {
        this.destroy(obj).then(res => {
          objs.splice(idx, 1);
          this.purchases.set(objs);
          this.onChange.emit({mode: 'destroy', purchase: obj});
        });
      } else {
        objs.splice(idx, 1);
        this.purchases.set(objs);
        this.onChange.emit({mode: 'destroy', purchase: obj});
      }
    }
  }
  add(obj: Purchase) {
    let objs = this.purchases();
    objs.push(obj);
    this.purchases.set(objs);
    this.onChange.emit({mode: 'create', purchase: obj});
  }
  edit(obj: Purchase) {
    let objs = this.purchases();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.purchases.set(objs);
      this.onChange.emit({mode: 'edit', purchase: obj});
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
      this.purchases.set(res);
      this.sending = false;
      alert("Compras salvas");
    }).catch(err => {
      console.error("PurchaseComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar recebimentos");
    });
  }
  export() {
    this.printMode = true;
    this.collapsed = false;
    setTimeout(() => {
      const doc = new jsPDF();
      autoTable(doc, { html: '#purchaseTable' });
      doc.save("despesas.pdf");
      setTimeout(() => {
        this.printMode = false;
      }, 1000);
    }, 1000);
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
}