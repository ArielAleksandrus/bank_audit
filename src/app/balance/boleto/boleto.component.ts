import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { Boleto } from '../../shared/models/boleto';
import { Tag } from '../../shared/models/tag';
import { Supplier } from '../../shared/models/supplier';

import { Utils } from '../../shared/helpers/utils';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-boleto',
  imports: [CommonModule, FormsModule,
            NgbCollapseModule, NgbPopoverModule,
            NgSelectComponent
          ],
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

  constructor(private api: ApiService) {
  }
  ngOnInit() {
    this.collapsed = this.collapse();


    Tag.loadTags(this.api).then((res: Tag[]) => {
      this.tags = Tag.fromJsonArray(res);
    });
    Supplier.loadSuppliers(this.api).then((res: Supplier[]) => {
      this.suppliers = Supplier.fromJsonArray(res);
    });
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
        });
      } else {
        objs.splice(idx, 1);
        this.boletos.set(objs);
        this.onChange.emit({mode: 'destroy', boleto: obj});
      }
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

  destroy(obj: Boleto): Promise<boolean> {
    return new Promise((resolve, reject) => {  
      if(!(obj.id > 0)) {
        resolve(false);
      }
      this.api.destroy('boletos', obj.id).subscribe(
        (res: any) => {
          resolve(true);
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
      this.sending = false;
      alert("Boletos salvos");
    }).catch(err => {
      console.error("BoletoComponent: Error saving: ", err);
      this.sending = false;
      alert("Erro ao salvar boletos");
    });
  }

  export() {
    this.printMode = true;
    this.collapsed = false;
    setTimeout(() => {
      const doc = new jsPDF();
      autoTable(doc, { html: '#boletoTable' });
      doc.save("boletos.pdf");
      setTimeout(() => {
        this.printMode = false;
      }, 1000);
    }, 1000);
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
}