import { ApiService } from '../services/api.service';
import { Filters } from '../helpers/filters';
import { Utils } from '../helpers/utils';

export class Tag {
	id: number;
	name: string;
	company_id: number;

	created_at: string;
	updated_at: string;


	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.name = jsonData.name;
		this.company_id = jsonData.company_id;
		this.created_at = jsonData.created_at;
		this.updated_at = jsonData.updated_at;
	}
	public static fromJsonArray(jsonArr: any[]) {
		let res = [];
		for(let data of jsonArr) {
			res.push(new Tag(data));
		}
		return res;
	}

	public static loadTags(api: ApiService): Promise<Tag[]> {
    return new Promise((resolve, reject) => {
      api.indexAll('tags').subscribe(
        (res: any) => {
          res.tags = Filters.orderAlphabetically(res.tags, 'name', false);
          resolve(res.tags);
        },
        (err: any) => {
          console.error("Tag->Failed to load tags: ", err);
          reject(err);
        }
      );
    });
	}

  public static loadSuggestions(api: ApiService, supplierNames: string[]): Promise<{[supplierName: string]: Tag[]}> {
  	let suggestions: {[supplierName: string]: Tag[]} = {};

  	return new Promise((resolve, reject) => {
	    api.show('tags', 'suggestions', {
	      supplier_names: supplierNames
	    }).subscribe(
	      (res: {[supplierName: string]: Tag[]}) => {
	        for(let supplierName in res) {
	          suggestions[supplierName] = res[supplierName];
	        }
	        resolve(suggestions);
	      },
	      (err: any) => {
	      	console.error("Tag->Failed to load tag suggestions: ", err);
	      	reject(err);
	      }
	    );
  	});
  }
}