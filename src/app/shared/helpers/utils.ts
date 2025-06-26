export const Utils = {
  clone: (obj: Object): any => {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = Utils.clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            //@ts-ignore
            if (obj.hasOwnProperty(attr)) copy[attr] = Utils.clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
  },
	countKeys: (obj: any) => {
		if(typeof obj != "object")
			return -1;
		
		return Object.keys(obj).length;
	},
  dateToString(date: Date | string, is_rails_timestamp: boolean = false, show_time: boolean = true): string|null {
    if(date == null)
        return null;

    if(typeof date == 'string') {
        date = new Date(date);
    }
    if(is_rails_timestamp) {
        date = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
    }
    let formatted_date = date.toISOString().substr(0, 10).split('-').reverse().join('/');
    let time = date.toISOString().substr(11, 8);

    if(show_time) {
        return formatted_date + ' ' + time;
    } else {
        return formatted_date;
    }
  },
  dateToISO(date: Date | string, zeroedTimezone: boolean = false): string|null {
    if(date == null)
        return null;
    
    if(typeof date == 'string') {
        date = new Date(date);
    }
    if(zeroedTimezone) {
      date = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000)); 
    }
    
    let month: any = date.getMonth() + 1;
    if(month < 10) {
      month = "0" + month;
    }
    let day: any = date.getDate();
    if(day < 10) {
      day = "0" + day;
    }
    let hours: any = date.getHours();
    if(hours < 10) {
      hours = "0" + hours;
    }
    let minutes: any = date.getMinutes();
    if(minutes < 10) {
      minutes = "0" + minutes;
    }
    let seconds: any = date.getSeconds();
    if(seconds < 10) {
      seconds = "0" + seconds;
    }
    return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },
  datePtBrToISO(date: string): string|null {
    if(date == null) {
      return null;
    }
    
    let sections: string[] = date.split(/-|\/|\./);
    let year = sections[2].split(' ')[0];
    let time = sections[2].split(' ')[1];
    return `${year}-${sections[1]}-${sections[0]}${!!time ? ' ' + time : ''}`;
  },
  equals( x: any, y: any ) {
    if ( x === y ) return true;
      // if both x and y are null or undefined and exactly the same

    if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
      // if they are not strictly equal, they both need to be Objects

    if ( x.constructor !== y.constructor ) return false;
      // they must have the exact same prototype chain, the closest we can do is
      // test there constructor.

    for ( var p in x ) {
      if ( ! x.hasOwnProperty( p ) ) continue;
        // other properties were tested using x.constructor === y.constructor

      if ( ! y.hasOwnProperty( p ) ) return false;
        // allows to compare x[ p ] and y[ p ] when set to undefined

      if ( x[ p ] === y[ p ] ) continue;
        // if they have the same strict value or identity then they are equal

      if ( typeof( x[ p ] ) !== "object" ) return false;
        // Numbers, Strings, Functions, Booleans must be strictly equal

      if ( ! Utils.equals( x[ p ],  y[ p ] ) ) return false;
        // Objects and Arrays must be tested recursively
    }

    for ( p in y ) {
      if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
        // allows x[ p ] to be set to undefined
    }
    return true;
  },
  findById: (value: number|string, items: any[], field: string = 'id'): any => {
    if(value == null) {
      return null;
    }
    
    for(let obj of items) {
      if(obj[field] == null)
        continue;
      if(obj[field].toString() == value.toString()) {
        return obj;
      }
    }
    return null;
  },
  pushIfNotExists(arr: Array<any>, toPush: any, field?: string): boolean {
    let found: boolean = false;
    for(let el of arr) {
      if(field) {
        if(el[field] == toPush[field]) {
          found = true;
          break;
        }
      } else {
        if(Utils.equals(el, toPush)) {
          found = true;
          break;
        }
      }
    }

    if(found) {
      return false;
    } else {
      arr.push(toPush);
      return true;
    }
  },
  sumDecimals(num1: string|number, num2: string|number, decimalPlaces: number = 2): number {
    return Number((Number(num1) + Number(num2)).toFixed(decimalPlaces));
  }
}