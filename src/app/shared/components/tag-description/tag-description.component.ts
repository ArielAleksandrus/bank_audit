import { Component, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgSelectComponent } from '@ng-select/ng-select';

import { Tag } from '../../models/tag';
import { ApiService } from '../../services/api.service';
import { Utils } from '../../helpers/utils';
import { Filters } from '../../helpers/filters';
import { StringHelpers } from '../../helpers/string-helpers';
import {
  TAG_CATEGORIES,
  TAG_CATEGORY_NAMES,
  TagCategoryDef,
  isRetiredTagCategory
} from '../../helpers/tag-categories';

// Suggested category by normalized tag name (no accents, lowercase).
const TAG_CATEGORY_HINTS: {[name: string]: string} = {
  aluguel: 'Fixa',
  energia: 'Fixa',
  telefonia: 'Fixa',
  saneamento: 'Fixa',
  funcionario: 'Fixa',
  encargo: 'Fixa',
  prolabore: 'Fixa',
  planosaude: 'Fixa',
  software: 'Fixa',
  contador: 'Fixa',
  seguro: 'Fixa',
  monitoramento: 'Fixa',
  pizza: 'Variável',
  insumo: 'Variável',
  proteina: 'Variável',
  vinho: 'Variável',
  laticinio: 'Variável',
  hortifruti: 'Variável',
  folhagens: 'Variável',
  bebida: 'Variável',
  gas: 'Variável',
  frete: 'Variável',
  distribuicao: 'Variável',
  cartao: 'Variável',
  evento: 'Esporádica',
  confraternizacao: 'Esporádica',
  cantor: 'Esporádica',
  curso: 'Esporádica',
  manutencaopredial: 'Esporádica',
  manutencaoequipamento: 'Esporádica',
  detetizacao: 'Esporádica',
  dedetizacao: 'Esporádica',
  equipamento: 'Investimento Material',
  mobiliario: 'Investimento Material',
  poupanca: 'Investimento Financeiro'
};

@Component({
  selector: 'app-tag-description',
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './tag-description.component.html',
  styleUrl: './tag-description.component.scss'
})
export class TagDescriptionComponent {
  tags = model.required<Tag[]>();
  onSave = output<Tag[]>();
  onClose = output<'next'|'close'>();

  categories: TagCategoryDef[] = TAG_CATEGORIES;
  categoryNames: string[] = [...TAG_CATEGORY_NAMES];

  constructor(private api: ApiService) {

  }

  ngOnInit() {
    this.clearRetiredCategories();
    this.applyCategoryHints();
    Tag.loadDescriptions(this.api).then((res: string[]) => {
      this.categoryNames = this.mergeCategories(res);
    });
  }

  valueChanged(desc: string) {
    if(desc && this.categoryNames.indexOf(desc) == -1 && !isRetiredTagCategory(desc)) {
      this.categoryNames = this.mergeCategories([desc]);
    }
  }

  send(idx: number = 0) {
    let tag: Tag = this.tags()[idx];
    if(!tag) {
      this.tags.set(this.tags());
      alert("Categorias salvas");
      this.onSave.emit(this.tags());
      return;
    }

    this._sendTag(tag).then(res => {
      this.send(idx + 1);
    });
  }

  next() {
    this.onClose.emit('next');
  }

  private clearRetiredCategories() {
    for(let tag of this.tags()) {
      if(tag.description && isRetiredTagCategory(tag.description))
        tag.description = '';
    }
  }

  private applyCategoryHints() {
    for(let tag of this.tags()) {
      if(tag.description)
        continue;
      const hint = TAG_CATEGORY_HINTS[this.normalizeName(tag.name)];
      if(hint)
        tag.description = hint;
    }
  }

  private mergeCategories(existing: string[]): string[] {
    const custom: string[] = [];
    for(let category of (existing || [])) {
      if(!category || TAG_CATEGORY_NAMES.indexOf(category) !== -1 || isRetiredTagCategory(category))
        continue;
      Utils.pushIfNotExists(custom, category);
    }
    for(let tag of this.tags()) {
      if(!tag.description || TAG_CATEGORY_NAMES.indexOf(tag.description) !== -1 || isRetiredTagCategory(tag.description))
        continue;
      Utils.pushIfNotExists(custom, tag.description);
    }
    return TAG_CATEGORY_NAMES.concat(Filters.orderAlphabetically(custom));
  }

  private normalizeName(name: string): string {
    return StringHelpers.removeAccent((name || '').toLowerCase()).replace(/[^a-z0-9]/g, '');
  }

  private _sendTag(tag: Tag): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.api.update('tags', tag.id, {
        tag: tag
      }).subscribe(
        (res: Tag) => {
          resolve(true);
        },
        (err: any) => {
          console.log("TagDescriptionComponent: could not save tag", tag);
          reject(err);
        }
      )
    })
  }
}
