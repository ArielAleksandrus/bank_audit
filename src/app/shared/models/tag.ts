import { ApiService } from '../services/api.service';
import { Filters } from '../helpers/filters';
import { Utils } from '../helpers/utils';

export class Tag {
	id: number;
	name: string;
	description: string;
	company_id: number;

	// only present when loaded from the tags list endpoint
	purchases_count: number;

	created_at: string;
	updated_at: string;


	constructor(jsonData: any) {
		this.id = jsonData.id;
		this.name = jsonData.name;
		this.description = jsonData.description;
		this.company_id = jsonData.company_id;
		this.purchases_count = jsonData.purchases_count;
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
          let tags = Tag.fromJsonArray(Filters.orderAlphabetically(res.tags, 'name', false));
          resolve(tags);
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
  		if(!supplierNames || supplierNames.length == 0) {
  			resolve({});
  			return;
  		}
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
  public static loadDescriptions(api: ApiService): Promise<string[]> {
  	let res: string[] = [];

  	return new Promise((resolve, reject) => {
	    api.show('tags', 'descriptions').subscribe(
	      (res: {descriptions: string[]}) => {
	        resolve(res.descriptions);
	      },
	      (err: any) => {
	      	console.error("Tag->Failed to load tag descriptions: ", err);
	      	reject(err);
	      }
	    );
  	});
  }

  public static getDescriptions(tags: Tag[]): string[] {
  	let res: string[] = [];
  	for(let tag of tags) {
  		if(!!tag.description)
  			Utils.pushIfNotExists(res, tag.description);
  	}

  	return res;
  }

  rename(api: ApiService, name: string): Promise<Tag> {
  	return new Promise((resolve, reject) => {
  		api.update('tags', this.id, { tag: { name: name } }).subscribe(
  			(res: any) => {
  				this.name = res.name;
  				resolve(this);
  			},
  			(err: any) => {
  				console.error("Tag->Failed to rename tag: ", err);
  				reject(err);
  			}
  		);
  	});
  }

  // Moves every purchase tagged with this tag over to `target` (across the
  // whole purchase history, not just what's currently loaded) and removes
  // this tag.
  mergeInto(api: ApiService, target: Tag): Promise<void> {
  	return new Promise((resolve, reject) => {
  		api.req('tags', { target_id: target.id }, { member: { id: this.id, value: 'merge' } }, 'post').subscribe(
  			(res: any) => {
  				resolve();
  			},
  			(err: any) => {
  				console.error("Tag->Failed to merge tag: ", err);
  				reject(err);
  			}
  		);
  	});
  }
}