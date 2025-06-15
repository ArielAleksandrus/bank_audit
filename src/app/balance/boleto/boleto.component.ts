import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { Boleto } from '../../shared/models/boleto';
import { Tag } from '../../shared/models/tag';

import { Utils } from '../../shared/helpers/utils';

@Component({
  selector: 'app-boleto',
  imports: [CommonModule, FormsModule, FontAwesomeModule,
            NgbCollapseModule, NgbPopoverModule,
            NgSelectComponent
          ],
  templateUrl: './boleto.component.html',
  styleUrl: './boleto.component.scss'
})
export class BoletoComponent {
  boletos = model.required<Boleto[]>();
  tags = model.required<Tag[]>();

  onChange = output<{mode: 'create'|'edit'|'destroy', boleto: Boleto}>();
  collapse = input<boolean>();

  collapsed?: boolean;

  selected?: Boleto;

  propagate: boolean = true;
  propagatePopover = "Se 'Copiar Tag' estiver ativo, todas as tags do boleto serão copiadas para todos os boletos deste fornecedor";

  constructor() {
  }
  ngOnInit() {
    this.collapsed = this.collapse();
  }

  remove(obj: Boleto) {
    let objs = this.boletos();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs.splice(idx, 1);
      this.boletos.set(objs);
      this.onChange.emit({mode: 'destroy', boleto: obj});
    }
  }
  add(obj: Boleto) {
    let objs = this.boletos();
    objs.push(obj);
    this.boletos.set(objs);
    this.onChange.emit({mode: 'create', boleto: obj});
  }
  edit(obj: Boleto) {
    let objs = this.boletos();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.boletos.set(objs);
      this.onChange.emit({mode: 'edit', boleto: obj});
    }
    this.selected = undefined;
  }

  open(obj?: Boleto) {
    if(!obj)
      obj = new Boleto({});

    this.selected = obj;
  }

  tagChanged(obj: Boleto, tags: Tag[]) {
    let availableTags = this.tags();
    let tagsAttr: string = 'auxTags';
    let comparisonAttr: string = 'supplier_name';
    let dataArr: Boleto[] = this.boletos();

    for(let tag of tags) {
      if(tag.id == null) { // tag was not created
        tag.id = -(new Date().getTime()); // add a negative id so we can create it when user saves
        availableTags.push(tag);
        availableTags = Utils.clone(availableTags);
      }
    }
    this.tags.set(availableTags);

    //@ts-ignore
    obj[tagsAttr] = tags;

    this.onChange.emit({mode: 'edit', boleto: obj});

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
        this.onChange.emit({mode: 'edit', boleto: dataObj});
        changed++;
      }
    }

    return changed;
  }
}