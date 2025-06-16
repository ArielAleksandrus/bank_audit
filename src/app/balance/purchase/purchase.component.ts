import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { Purchase, PAYMENT_TRANSLATION  } from '../../shared/models/purchase';
import { Tag } from '../../shared/models/tag';

import { Utils } from '../../shared/helpers/utils';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-purchase',
  imports: [CommonModule, FormsModule, FontAwesomeModule,
            NgbCollapseModule, NgbPopoverModule,
            NgxMaskDirective,
            NgSelectComponent
          ],
  providers: [provideNgxMask()],
  templateUrl: './purchase.component.html',
  styleUrl: './purchase.component.scss'
})
export class PurchaseComponent {
  purchases = model.required<Purchase[]>();
  tags: Tag[] = [];
  onChange = output<{mode: 'create'|'edit'|'destroy', purchase: Purchase}>();
  collapse = input<boolean>();

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
  }

  remove(obj: Purchase) {
    let objs = this.purchases();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs.splice(idx, 1);
      this.purchases.set(objs);
      this.onChange.emit({mode: 'destroy', purchase: obj});
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

  open(obj?: Purchase) {
    if(!obj)
      obj = new Purchase({});

    this.selected = obj;
  }

  tagChanged(obj: Purchase, tags: Tag[]) {
    let tagsAttr: string = 'aux_tags';
    let comparisonAttr: string = 'supplier_name';
    let dataArr: Purchase[] = this.purchases();

    for(let tag of tags) {
      if(tag.id == null) { // tag was not created
        tag.id = -(new Date().getTime()); // add a negative id so we can create it when user saves
        Utils.pushIfNotExists(tags, tag, 'name');
      }
    }
    tags = Utils.clone(tags);

    //@ts-ignore
    obj[tagsAttr] = tags;

    this.onChange.emit({mode: 'edit', purchase: obj});

    if(this.propagate)
      this._propagateTags(obj, tagsAttr, comparisonAttr, dataArr);
  }
  private _propagateTags(changedObj: any, tagsAttr: string, comparisonAttr: string, dataArr: any[]): number {
    let changed: number = 0;

    let tags = changedObj[tagsAttr];

    for(let i = 0; i < dataArr.length; i++) {
      let dataObj = dataArr[i];
      if(changedObj[comparisonAttr] == dataObj[comparisonAttr] && !Utils.equals(changedObj[tagsAttr], dataObj[tagsAttr])) {
        dataObj[tagsAttr] = Utils.clone(changedObj[tagsAttr]);
        this.onChange.emit({mode: 'edit', purchase: dataObj});
        changed++;
      }
    }

    return changed;
  }
}