import { Utils } from '../helpers/utils';

/**
 * EXCEL ASSUMPTIONS:
 * 	1. first row will contain header cols, and one of them will be named VALOR and other will be HISTÓRICO
 * 	
 */

export class SicoobParser {
	dataArr: any[];

	parsedHeaders: string[];
	parsedRows: any[];

	descriptions = {
		boleto: ["DÉB.TIT", "DÉB.TÍT", "DÉB. PAGAMENTO DE BOLETO"],
		receita: ["CR COMPRAS"],
		seguro: ["DÉB. CONV. SEGURO"]
	};

	organizedData = {
		boleto: [],
		receita: [],
		seguro: [],
		outros: []
	};

	constructor(dataArr: any[], dataType: 'excel') {
		this.dataArr = dataArr;
		this.parsedHeaders = [];
		this.parsedRows = [];

		switch(dataType) {
		case('excel'): {
			this.parseExcel();
		}
		}
	}

	parseExcel() {
		if(!this.dataArr || this.dataArr.length < 2) {
			console.error("SicoobParser: dataArr is too small");
		}

		this.parseExcelHeader();
		this.parseExcelRows();
	}
	parseExcelHeader() {
		this.parsedHeaders = [];
		// row 0 shows us the header columns
		for(let key in this.dataArr[0]) {
			if(key == "__rowNum__")
				continue;

			this.parsedHeaders.push(this.dataArr[0][key]);
		}
	}
	parseExcelRows() {
		this.parsedRows = [];
		// rows with less than header.count cols are information like "Saldo do Dia: " and is not considered
		const colsQty = this.parsedHeaders.length; // __rowNum__ is not counted in Utils.countKeys
		for(let i = 1; i < this.dataArr.length; i++) {
			let row = this.dataArr[i];

			if(Utils.countKeys(row) < colsQty)
				continue;

			let aux = [];
			for(let key in row) {
				if(key == "__rowNum__")
					continue;
				aux.push(row[key]);
			}
			
			if(aux[0] == '')
				continue;

			this.parsedRows.push(aux);
		}
		this.fixPaymentValue();
		this.classifyDescription();
	}
	fixPaymentValue() {
		const valorIdx = this.parsedHeaders.indexOf("VALOR");

		for(let row of this.parsedRows) {
			let valStr = row[valorIdx];
			let nbSpace = String.fromCharCode(160);
			valStr = valStr.replace(".","").replace(",",".").replace(" ","").replace(nbSpace,""); // '- 16.309,27 D' will become '-16309.27D'
			if(valStr[valStr.length - 1] == "D") { // if is 'D', which is debit, check if the minus sign is first. '130D' will become '-130D'
				if(valStr[0] != '-')
					valStr = "-" + valStr;
			}
			
			// remove 'C' and 'D' letters
			valStr = valStr.split("C").join("");
			valStr = valStr.split("D").join("");

			row[valorIdx] = Number.parseFloat(valStr);
		}
	}
	getDescriptionType(desc: string) {
		for(let type in this.descriptions) {
			//@ts-ignore
			for(let match of this.descriptions[type]) {
				if(desc.indexOf(match) > -1) {
					if(type == "receita") {
						return "receita" + (desc.split(match)[1] || '');
					}

					return type;
				}
			}
		}
		return "outros";
	}
	classifyDescription() {
		this.organizedData = {
			boleto: [],
			receita: [],
			seguro: [],
			outros: []
		};
		const histIdx = this.parsedHeaders.indexOf("HISTÓRICO");

		for(let row of this.parsedRows) {
			const desc = row[histIdx];
			const type = this.getDescriptionType(desc);
			row.push(type);

			let auxType = type.split(" ")[0];
			//@ts-ignore
			this.organizedData[auxType].push(row);
		}
	}
}