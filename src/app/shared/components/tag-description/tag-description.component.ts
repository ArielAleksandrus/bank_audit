import { Component, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';

import { Tag } from '../../models/tag';
import { ApiService } from '../../services/api.service';
import { Utils } from '../../helpers/utils';
import { Filters } from '../../helpers/filters';

@Component({
  selector: 'app-tag-description',
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './tag-description.component.html',
  styleUrl: './tag-description.component.scss'
})
export class TagDescriptionComponent {
  tags = model.required<Tag[]>();

  descriptions: string[] = [];

  constructor(private api: ApiService) {

  }

  ngOnInit() {
    Tag.loadDescriptions(this.api).then((res: string[]) => {
      this.descriptions = res;
    });
  }

  valueChanged(desc: string) {
    if(this.descriptions.indexOf(desc) == -1) {
      this.descriptions.push(desc);
      this.descriptions = Utils.clone(Filters.orderAlphabetically(this.descriptions));
    }
  }

  send(idx: number = 0) {
    let tag: Tag = this.tags()[idx];
    if(!tag) {
      this.tags.set(this.tags());
      alert("Descrições salvas");
      return;
    }

    this._sendTag(tag).then(res => {
      this.send(idx + 1);
    });
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
