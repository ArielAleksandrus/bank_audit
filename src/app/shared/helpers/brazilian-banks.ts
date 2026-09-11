// Ids match app/services/brazilian_banks.rb on the API 1:1 - this is what
// keys GeneratedParser reuse there, so picking from this closed list (instead
// of letting the user free-type a bank name) is what makes a bank's parser
// get reused across uploads instead of fragmenting into near-duplicate keys.
export const BRAZILIAN_BANKS: {id: string, name: string}[] = [
	{ id: 'itau', name: 'Itaú' },
	{ id: 'bb', name: 'Banco do Brasil' },
	{ id: 'bradesco', name: 'Bradesco' },
	{ id: 'santander', name: 'Santander' },
	{ id: 'caixa', name: 'Caixa Econômica' },
	{ id: 'nubank', name: 'Nubank' },
	{ id: 'inter', name: 'Banco Inter' },
	{ id: 'sicoob', name: 'Sicoob' },
	{ id: 'sicredi', name: 'Sicredi' },
	{ id: 'c6', name: 'C6 Bank' },
	{ id: 'stone', name: 'Stone' },
	{ id: 'brb', name: 'BRB' },
	{ id: 'safra', name: 'Banco Safra' },
	{ id: 'btg', name: 'BTG Pactual' },
	{ id: 'original', name: 'Banco Original' },
	{ id: 'pagbank', name: 'PagBank' },
	{ id: 'banrisul', name: 'Banrisul' },
	{ id: 'banese', name: 'Banese' },
	{ id: 'banpara', name: 'Banpará' },
	{ id: 'banestes', name: 'Banestes' },
	{ id: 'next', name: 'Next' },
	{ id: 'neon', name: 'Neon' },
	{ id: 'picpay', name: 'PicPay' },
	{ id: 'mercadopago', name: 'Mercado Pago' },
	{ id: 'sofisa', name: 'Banco Sofisa' },
	{ id: 'pine', name: 'Banco Pine' },
	{ id: 'votorantim', name: 'Banco Votorantim' },
	{ id: 'daycoval', name: 'Banco Daycoval' },
	{ id: 'abc', name: 'ABC Brasil' },
	{ id: 'outros', name: 'Outros' }
];
