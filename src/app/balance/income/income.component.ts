import { Component, model, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';

import { Income } from '../../shared/models/income';
import { ApiService } from '../../shared/services/api.service';

@Component({
  selector: 'app-income',
  imports: [CommonModule, FormsModule, FontAwesomeModule,
            NgbCollapseModule, NgbPopoverModule,
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
  sending: boolean = false;

  collapsed?: boolean;

  selected?: Income;

  constructor(private api: ApiService) {
  }
  ngOnInit() {
    this.collapsed = this.collapse();
  }

  save() {
    if(!this.canSave) {
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

  remove(obj: Income) {
    let objs = this.incomes();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs.splice(idx, 1);
      this.incomes.set(objs);
      this.onChange.emit({mode: 'destroy', income: obj});
    }
  }
  add(obj: Income) {
    let objs = this.incomes();
    objs.push(obj);
    this.incomes.set(objs);
    this.onChange.emit({mode: 'create', income: obj});
  }
  edit(obj: Income) {
    let objs = this.incomes();
    let idx = objs.indexOf(obj);
    if(idx > -1) {
      objs[idx] = obj;
      this.incomes.set(objs);
      this.onChange.emit({mode: 'edit', income: obj});
    }
    this.selected = undefined;
  }

  open(obj?: Income) {
    if(!obj)
      obj = new Income({});

    this.selected = obj;
  }
}
