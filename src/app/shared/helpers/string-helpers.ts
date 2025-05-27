import { Constants } from './constants';

export const StringHelpers = {
  removeAccent: (str: any) => {
    var accents    = Constants.accents;
    var accentsOut = Constants.accentsOut;
    str = str.split('');
    var strLen = str.length;
    var i, x;
    for (i = 0; i < strLen; i++) {
      if ((x = accents.indexOf(str[i])) != -1) {
        str[i] = accentsOut[x];
      }
    }
    return str.join('');
  },
  singular: (str: any) => {
    let nstr = StringHelpers.removeAccent(str.toLowerCase());

    if(nstr.lastIndexOf('oes') != -1 && nstr.lastIndexOf('oes') == nstr.length - 3) {
      return nstr.substring(0, nstr.length - 3) + "ao";
    }
    if(nstr.lastIndexOf('aes') != -1 && nstr.lastIndexOf('aes') == nstr.length - 3) {
      return nstr.substring(0, nstr.length - 3) + "ao";
    }
    if(nstr.lastIndexOf('eis') != -1 && nstr.lastIndexOf('eis') == str.length - 3) {
      return nstr.substring(0, nstr.length - 3) + "el";
    }
    if(nstr.length > 1 && 's' == nstr[nstr.length - 1]) {
      return nstr.substring(0, nstr.length - 1);
    }

    return str;
  },
  genCharArray(from: string, to: string): string[] {
    let res: string[] = [];

    if(to < from) {
      let aux = to;
      to = from;
      from = aux;
    }
    let i = from.charCodeAt(0);
    let j = to.charCodeAt(0);

    for(; i <= j; i++) {
      res.push(String.fromCharCode(i));
    }

    return res;
  }
}