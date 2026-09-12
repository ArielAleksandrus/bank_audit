import { OmniParser } from './omni-parser';

describe('OmniParser', () => {
	let parser: OmniParser;

	beforeEach(() => {
		parser = new OmniParser('outro');
	});

	it('parses a Sicoob-like Excel grid using histórico as the name', () => {
		parser.parseExtrato([
			['DATA', 'DOCUMENTO', 'HISTÓRICO', 'VALOR', 'INFORMAÇÕES COMPLEMENTARES'],
			['01/04/2025', '123', 'PIX RECEBIDO', '150,00', 'JOAO SILVA'],
			['01/04/2025', '124', 'DÉB. PAGAMENTO DE BOLETO', '- 16.309,27 D', ''],
			['02/04/2025', '', 'SALDO DO DIA', '5.000,00', ''],
			['02/04/2025', '125', 'CR COMPRAS MAESTRO', '200,00', ''],
			['03/04/2025', '126', 'CRÉD.TED', '1000,00', 'EMPRESA X']
		], 'excel');

		expect(parser.incomes.length).toBe(3);
		expect(parser.boletos.length).toBe(1);
		expect(parser.purchases.length).toBe(0);

		const pix = parser.incomes.find(i => i.income_type == 'pix')!;
		expect(pix.origin).toBe('JOAO SILVA');
		expect(pix.value).toBe(150);
		expect(pix.date_received).toBe('2025-04-01');

		const ted = parser.incomes.find(i => i.income_type == 'deposito')!;
		expect(ted.origin).toBe('EMPRESA X');

		const card = parser.incomes.find(i => i.income_type == 'cartao')!;
		expect(card.additional_info).toContain('mastercard débito');

		expect(parser.boletos[0].supplier_name).toBe('DÉB. PAGAMENTO DE BOLETO');
		expect(Number(parser.boletos[0].value)).toBe(16309.27);
		expect(parser.boletos[0].bank_identification).toBe('124');
	});

	it('parses a Stone-like Excel object sheet', () => {
		parser.parseExtrato([
			{
				'Movimentação': 'Crédito',
				'Tipo': 'Pix',
				'Valor': '1.710,00',
				'Data': '30/04/2025 14:31',
				'Origem': 'VANESSA M',
				'Destino': 'El mare'
			},
			{
				'Movimentação': 'Débito',
				'Tipo': 'Pix',
				'Valor': '-50,00',
				'Data': '30/04/2025 14:32',
				'Origem': 'El mare',
				'Destino': 'GRACIELE F'
			},
			{
				'Movimentação': 'Crédito',
				'Tipo': 'Recebível de Cartão',
				'Valor': '80,00',
				'Data': '01/05/2025 10:00',
				'Origem': 'Stone',
				'Destino': 'El mare'
			}
		], 'excel');

		expect(parser.incomes.length).toBe(2);
		expect(parser.purchases.length).toBe(1);
		expect(parser.purchases[0].supplier_name).toBe('GRACIELE F');
		expect(parser.purchases[0].payment_type).toBe('pix');

		const pixIn = parser.incomes.find(i => i.income_type == 'pix')!;
		expect(pixIn.origin).toBe('VANESSA M');
		expect(pixIn.date_received).toBe('2025-04-30');

		const card = parser.incomes.find(i => i.income_type == 'cartao')!;
		expect(card.origin).toBe('Stone');
	});

	it('parses a Sicredi-like OFX file', () => {
		const ofx = [
			'OFXHEADER:100',
			'<STMTTRN>',
			'<TRNTYPE>CREDIT</TRNTYPE>',
			'<DTPOSTED>20250401000000[-3:GMT]</DTPOSTED>',
			'<TRNAMT>184.00</TRNAMT>',
			'<FITID>17376954452</FITID>',
			'<REFNUM>17376954452</REFNUM>',
			'<MEMO>RECEBIMENTO PIX-PIX_CRED  55494138000186 VANESSA M</MEMO>',
			'</STMTTRN>',
			'<STMTTRN>',
			'<TRNTYPE>DEBIT</TRNTYPE>',
			'<DTPOSTED>20250402000000[-3:GMT]</DTPOSTED>',
			'<TRNAMT>-90.50</TRNAMT>',
			'<MEMO>DEBITO TED FORNECEDOR LTDA</MEMO>',
			'</STMTTRN>'
		].join('\n');

		parser.parseExtrato([ofx], 'ofx');

		expect(parser.incomes.length).toBe(1);
		expect(parser.purchases.length).toBe(1);
		expect(parser.incomes[0].income_type).toBe('pix');
		expect(parser.incomes[0].origin).toContain('VANESSA M');
		expect(parser.incomes[0].value).toBe(184);
		expect(parser.incomes[0].date_received).toBe('2025-04-01');
		expect(parser.purchases[0].payment_type).toBe('transfer');
		expect(Number(parser.purchases[0].total)).toBe(90.5);
	});

	it('skips title rows and does not treat saldo as the launch value', () => {
		parser.parseExtrato([
			['EXTRATO BANCARIO', '', '01/09/2026'],
			['Conta', '12345-6', ''],
			[],
			['DATA', 'HISTÓRICO', 'VALOR', 'SALDO'],
			['10/04/2025', 'PIX RECEBIDO', '100,00', '1.000,00'],
			['11/04/2025', 'TARIFA BANCARIA PACOTE', '-15,00', '985,00']
		], 'excel');

		expect(parser.incomes.length).toBe(1);
		expect(parser.purchases.length).toBe(1);
		expect(parser.incomes[0].value).toBe(100);
		expect(Number(parser.purchases[0].total)).toBe(15);
		expect(parser.purchases[0].payment_type).toBe('auto_debit');
	});

	it('uses débito/crédito columns for direction', () => {
		parser.parseExtrato([
			['Data', 'Histórico', 'Débito', 'Crédito'],
			['12/04/2025', 'TRANSF.RECEBIDA CLIENTE', '', '300,00'],
			['13/04/2025', 'PAGAMENTO PIX FORNECEDOR', '40,00', '']
		], 'excel');

		expect(parser.incomes.length).toBe(1);
		expect(parser.purchases.length).toBe(1);
		expect(parser.incomes[0].value).toBe(300);
		expect(parser.incomes[0].income_type).toBe('pix');
		expect(parser.purchases[0].payment_type).toBe('pix');
		expect(Number(parser.purchases[0].total)).toBe(40);
	});

	it('resets previous results when parsing again', () => {
		parser.parseExtrato([
			['DATA', 'HISTÓRICO', 'VALOR'],
			['10/04/2025', 'PIX RECEBIDO', '10,00']
		], 'excel');
		parser.parseExtrato([
			['DATA', 'HISTÓRICO', 'VALOR'],
			['11/04/2025', 'PIX RECEBIDO', '20,00']
		], 'excel');

		expect(parser.incomes.length).toBe(1);
		expect(parser.incomes[0].value).toBe(20);
	});
});
