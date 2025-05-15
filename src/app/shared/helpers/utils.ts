export const Utils = {
	countKeys: (obj: any) => {
		if(typeof obj != "object")
			return -1;
		
		return Object.keys(obj).length;
	}
}