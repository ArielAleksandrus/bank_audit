import { BalanceParser } from './balance-parser';
import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income } from '../models/income';

export class AiParser extends BalanceParser {
	override acceptedFormats: string = ".xls,.xlsx,.ofx,.csv";
	override allowsComprovantes: boolean = true;

	override parseExtrato(_dataArr: any[], _dataType: string): void {
		// Server / sandbox parsers fill applyResult.
	}
}
