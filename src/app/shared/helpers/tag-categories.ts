export type TagCategoryKind = 'expense' | 'material-investment' | 'financial-investment';

export type TagCategoryDef = {
  name: string;
  meaning: string;
  examples: string;
  kind: TagCategoryKind;
  recurring?: boolean;
};

export const TAG_CATEGORIES: TagCategoryDef[] = [
  {
    name: 'Fixa',
    meaning: 'Paga todo mês, mesmo sem venda.',
    examples: 'Aluguel, salário, software, contador',
    kind: 'expense',
    recurring: true
  },
  {
    name: 'Variável',
    meaning: 'Sobe e desce com o movimento.',
    examples: 'Insumo, frete, comissão, taxa de cartão',
    kind: 'expense',
    recurring: true
  },
  {
    name: 'Esporádica',
    meaning: 'Não faz parte da rotina; dá para adiar ou cortar.',
    examples: 'Conserto, multa, confraternização',
    kind: 'expense'
  },
  {
    name: 'Investimento Material',
    meaning: 'Compra que fica na empresa.',
    examples: 'Equipamento, móvel, reforma, veículo',
    kind: 'material-investment'
  },
  {
    name: 'Investimento Financeiro',
    meaning: 'Dinheiro aplicado em poupança, CDB ou fundos.',
    examples: 'Poupança, fundo de investimento',
    kind: 'financial-investment'
  }
];

export const TAG_CATEGORY_NAMES: string[] = TAG_CATEGORIES.map(c => c.name);

// Nature-of-expense labels from an earlier version — keep them out of the typeahead.
export const RETIRED_TAG_CATEGORIES: string[] = [
  'Insumos',
  'Pessoal',
  'Ocupação',
  'Manutenção',
  'Operacional',
  'Administrativo',
  'Marketing',
  'Impostos',
  'Investimento',
  'Financeiro'
];

export function tagCategoryOf(name: string): TagCategoryDef | undefined {
  return TAG_CATEGORIES.find(c => c.name === name);
}

export function isRetiredTagCategory(name: string): boolean {
  return RETIRED_TAG_CATEGORIES.indexOf(name) !== -1;
}
