import { StringHelpers } from './string-helpers';

export const Filters = {
  filterArrayByText: (items: any[], field : string, value : string|number): any[] => {  
    let aux: string = `${value}`;
    if (!items) return [];
    if (!aux || aux.length == 0) return items;

    return items.filter(it => 
    StringHelpers.removeAccent(it[field].toLowerCase()).indexOf(StringHelpers.removeAccent(aux.toLowerCase())) !=-1);
  },
  orderAlphabetically: (items: any[], field: string|null = null, numericality: boolean = true): any [] => {
    if(!items) return[];
    if(!field || field.length == 0) {
      return items.sort((a: any, b: any) => {
        if(typeof a != 'string')
          a = a.toString();
        if(typeof b != 'string') {
          b = b.toString();
        }
        return Filters.compareStrings(a, b, numericality);
      });
    } else {
      return items.sort((a: any, b: any) => {
        let aux_a = a[field];
        let aux_b = b[field];

        if(typeof a[field] != 'string')
          aux_a = aux_a.toString();
        if(typeof b[field] != 'string') {
          aux_b = aux_b.toString();
        }
        return Filters.compareStrings(aux_a, aux_b, numericality);
      });
    }
  },
  orderDates(items: any[], field: string|null = null, crescent: boolean = true) {
    if(!items) return[];

    let result: any = null;
    if(!field || field.length == 0) {
      result = items.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return (new Date(b)).getTime() - (new Date(a)).getTime();
      });
    } else {
      result = items.sort((a: any, b: any) => {
        let aux_a = new Date(a[field]);
        let aux_b = new Date(b[field]);

        return aux_b.getTime() - aux_a.getTime();
      });
    }
    
    return crescent ? result.reverse() : result;
  },
  compareStrings: (a: string, b: string, numericality: boolean = true): number => {
    // Assuming you want case-insensitive comparison
    a = StringHelpers.removeAccent(a.toLowerCase());
    b = StringHelpers.removeAccent(b.toLowerCase());

    if(numericality) {
      if(!isNaN(parseInt(a)))
        a = <any>parseInt(a);
      if(!isNaN(parseInt(b)))
        b = <any>parseInt(b);
    }
    
    if(typeof a != typeof b) {
      return typeof a == "string" ? 1 : -1;
    }

    return (a < b) ? -1 : (a > b) ? 1 : 0;
  }
}