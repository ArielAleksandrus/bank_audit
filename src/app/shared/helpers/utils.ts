export const Utils = {
	countKeys: (obj: any) => {
		if(typeof obj != "object")
			return -1;
		
		return Object.keys(obj).length;
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
  findInMatrix: (value: number|string, items: any[][], colIdx: number): any => {
    if(value == null) {
      return null;
    }
    
    for(let row of items) {
      if(row == null || row[colIdx] == null)
        continue;
      if(row[colIdx].toString() == value.toString()) {
        return row;
      }
    }
    return null;
  }
}