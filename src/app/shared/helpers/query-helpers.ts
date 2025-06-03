export const QueryHelpers = {

	queryIntervalParams: (attr: string, from: string|number|null, to: string|number|null, comp1: '>'|'>=' = '>=', comp2: '<'|'<=' = '<='): any => {
		let param: any = {
			q_interval: {}
		};
		let val = [];
		if(from != null) {
			val.push(`${comp1}${from}`);
		}
		if(to != null) {
			val.push(`${comp2}${to}`);
		}
		param.q_interval[attr] = val;

		return param;
	}
}