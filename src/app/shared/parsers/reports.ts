import { Utils } from '../helpers/utils';
import { Filters } from '../helpers/filters';
import { TAG_CATEGORIES, tagCategoryOf } from '../helpers/tag-categories';

import { Boleto } from '../models/boleto';
import { Purchase } from '../models/purchase';
import { Income, IncomeSummary } from '../models/income';
import { Tag } from '../models/tag';

export type TagClassification = {classification: {tagName: string, value: number}[], total: number};
export type ReportTagNode = {
	name: string;
	purchases: Purchase[];
	total: number;
	children: ReportTagNode[];
};
export type DescribedReport = {
	descriptions: {
		description: string,
		tags: ReportTagNode[],
		total: number
	}[],
	total: number,
	recurringTotal: number,
	expenseTotal: number,
	materialInvestmentTotal: number,
	financialInvestmentTotal: number
};
export class Reports {
	boletos: Boleto[] = [];
	incomes: Income[] = [];
	purchases: Purchase[] = [];

	tags: Tag[] = []; // extracted from purchases
	tagDescriptions: string[] = []; // extracted from tags

	constructor(incomes: Income[], purchases: Purchase[], boletos: Boleto[]) {
		this.incomes = incomes;
		this.purchases = purchases;
		this.boletos = boletos;
		this.tags = Filters.orderAlphabetically(Purchase.getTags(this.purchases), 'name', false);
		this.tagDescriptions = Tag.getDescriptions(this.tags);
	}

	describedReport(purchases?: Purchase[]): DescribedReport{
		if(purchases)
			this.purchases = purchases;

		const forest = this._buildTagForest(this.purchases);

		let res: DescribedReport = {
			descriptions: [],
			total: 0,
			recurringTotal: 0,
			expenseTotal: 0,
			materialInvestmentTotal: 0,
			financialInvestmentTotal: 0
		};

		const byDescription: {[desc: string]: ReportTagNode[]} = {};
		for(const root of forest) {
			const tag: Tag | undefined = Utils.findById(root.name, this.tags, 'name');
			const desc: string = tag?.description || 'Não categorizado';
			if(!byDescription[desc])
				byDescription[desc] = [];
			byDescription[desc].push(root);
		}

		for(const description in byDescription) {
			const tags = byDescription[description].sort((a, b) => b.total - a.total);
			let descriptionEl = {
				description,
				tags,
				total: 0
			};
			for(const node of tags)
				descriptionEl.total += node.total;
			descriptionEl.total = Number(descriptionEl.total.toFixed(2));
			res.descriptions.push(descriptionEl);

			const category = tagCategoryOf(description);
			if(category?.kind === 'material-investment') {
				res.materialInvestmentTotal += descriptionEl.total;
			} else if(category?.kind === 'financial-investment') {
				res.financialInvestmentTotal += descriptionEl.total;
			} else {
				res.expenseTotal += descriptionEl.total;
				if(category?.recurring) {
					res.recurringTotal += descriptionEl.total;
				}
			}
		}
		res.descriptions.sort((a, b) => this._categoryOrder(a.description) - this._categoryOrder(b.description));
		res.recurringTotal = Number(res.recurringTotal.toFixed(2));
		res.expenseTotal = Number(res.expenseTotal.toFixed(2));
		res.materialInvestmentTotal = Number(res.materialInvestmentTotal.toFixed(2));
		res.financialInvestmentTotal = Number(res.financialInvestmentTotal.toFixed(2));
		res.total = res.expenseTotal;
		return res;
	}

	private _categoryOrder(name: string): number {
		const idx = TAG_CATEGORIES.findIndex(c => c.name === name);
		if(idx >= 0)
			return idx;
		if(name === 'Não categorizado')
			return 1000;
		return 500;
	}

	boletoTagChart(boletos: Boleto[]): TagClassification {
		return this._tagChart(boletos, 'auxTags', 'value');
	}
	purchaseTagChart(purchases: Purchase[]): TagClassification {
		return this._tagChart(purchases, 'tags', 'total');
	}
	incomeSummary(incomes: Income[]): IncomeSummary {
		return Income.calculateIncomeSummary(incomes);
	}

	// Multi-tag purchases form a chain ordered by how often each tag appears.
	// The most-used tag is the parent; a carne-only purchase still hangs under
	// that chain if carne was seen together with proteina/insumo elsewhere.
	private _buildTagForest(purchases: Purchase[]): ReportTagNode[] {
		const usage = this._tagUsage(purchases);
		const parentOf = this._tagParents(purchases, usage);
		const nodes: {[name: string]: ReportTagNode & {direct: Purchase[]}} = {};

		const ensure = (name: string) => {
			if(!nodes[name])
				nodes[name] = {name, purchases: [], total: 0, children: [], direct: []};
			return nodes[name];
		};

		for(const name in usage)
			ensure(name);

		for(const child in parentOf) {
			ensure(parentOf[child]).children.push(ensure(child));
		}

		for(const purchase of purchases) {
			const names = this._purchaseTagNames(purchase);
			if(names.length === 0)
				continue;
			const deepest = this._deepestTagNode(names, parentOf);
			ensure(deepest).direct.push(purchase);
		}

		const rollup = (node: ReportTagNode & {direct: Purchase[]}) => {
			let purchasesAcc: Purchase[] = node.direct.slice();
			let total = this._purchasesTotal(node.direct);
			for(const child of node.children) {
				rollup(child as ReportTagNode & {direct: Purchase[]});
				purchasesAcc = purchasesAcc.concat(child.purchases);
				total += child.total;
			}
			node.purchases = purchasesAcc;
			node.total = Number(total.toFixed(2));
			node.children = node.children.filter(c => c.purchases.length > 0)
				.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
		};

		const roots: ReportTagNode[] = [];
		for(const name in nodes) {
			if(parentOf[name])
				continue;
			const node = nodes[name];
			rollup(node);
			if(node.purchases.length > 0)
				roots.push(node);
		}
		return roots.sort((a, b) => b.total - a.total);
	}

	private _tagUsage(purchases: Purchase[]): {[name: string]: number} {
		const usage: {[name: string]: number} = {};
		for(const purchase of purchases) {
			for(const name of this._purchaseTagNames(purchase))
				usage[name] = (usage[name] || 0) + 1;
		}
		return usage;
	}

	private _purchaseTagNames(purchase: Purchase): string[] {
		const names: string[] = [];
		for(const tag of (purchase.tags || [])) {
			if(tag?.name && names.indexOf(tag.name) === -1)
				names.push(tag.name);
		}
		return names;
	}

	private _sortByUsage(names: string[], usage: {[name: string]: number}): string[] {
		return names.slice().sort((a, b) => (usage[b] || 0) - (usage[a] || 0) || a.localeCompare(b, 'pt-BR'));
	}

	private _tagParents(purchases: Purchase[], usage: {[name: string]: number}): {[child: string]: string} {
		const votes: {[child: string]: {[parent: string]: number}} = {};
		for(const purchase of purchases) {
			const names = this._purchaseTagNames(purchase);
			if(names.length < 2)
				continue;
			const ordered = this._sortByUsage(names, usage);
			for(let i = 1; i < ordered.length; i++) {
				const child = ordered[i];
				const parent = ordered[i - 1];
				if(child === parent)
					continue;
				if(!votes[child])
					votes[child] = {};
				votes[child][parent] = (votes[child][parent] || 0) + 1;
			}
		}

		const parentOf: {[child: string]: string} = {};
		const children = Object.keys(votes).sort((a, b) => (usage[a] || 0) - (usage[b] || 0));
		for(const child of children) {
			let bestParent = '';
			let bestVote = -1;
			for(const parent in votes[child]) {
				const vote = votes[child][parent];
				const better = vote > bestVote
					|| (vote === bestVote && (usage[parent] || 0) > (usage[bestParent] || 0))
					|| (vote === bestVote && (usage[parent] || 0) === (usage[bestParent] || 0) && parent.localeCompare(bestParent, 'pt-BR') < 0);
				if(better) {
					bestVote = vote;
					bestParent = parent;
				}
			}
			if(!bestParent || bestParent === child)
				continue;
			if(this._wouldCycle(child, bestParent, parentOf))
				continue;
			parentOf[child] = bestParent;
		}
		return parentOf;
	}

	private _wouldCycle(child: string, parent: string, parentOf: {[name: string]: string}): boolean {
		let cur: string | undefined = parent;
		const seen: {[name: string]: boolean} = {};
		seen[child] = true;
		while(cur) {
			if(seen[cur])
				return true;
			seen[cur] = true;
			cur = parentOf[cur];
		}
		return false;
	}

	private _deepestTagNode(names: string[], parentOf: {[child: string]: string}): string {
		let best = names[0];
		let bestDepth = this._tagDepth(best, parentOf);
		for(let i = 1; i < names.length; i++) {
			const depth = this._tagDepth(names[i], parentOf);
			if(depth > bestDepth) {
				best = names[i];
				bestDepth = depth;
			}
		}
		return best;
	}

	private _tagDepth(name: string, parentOf: {[child: string]: string}): number {
		let depth = 0;
		let cur: string | undefined = parentOf[name];
		const seen: {[name: string]: boolean} = {};
		while(cur && !seen[cur]) {
			seen[cur] = true;
			depth++;
			cur = parentOf[cur];
		}
		return depth;
	}

	private _purchasesTotal(purchases: Purchase[]): number {
		let total = 0;
		for(const purchase of purchases)
			total += Number(purchase.total);
		return total;
	}
	private _tagChart(objs: any[], tagsAttr: string = 'tags', valueAttr: string = 'value'): TagClassification {
		let res: TagClassification = {classification: [], total: 0};

		if(!objs || objs.length == 0)
			return res;

		let aux: any = {};

		for(let obj of objs) {
			let value = Number(obj[valueAttr]);
			let tags = obj[tagsAttr];
			if(!tags || tags.length == 0) {
				aux["Não classificado"] = (aux["Não classificado"] || 0) + value;
			} else {
				for(let tag of tags) {
					aux[tag.name] = (aux[tag.name] || 0) + value;
				}
			}
			res.total += Number(value.toFixed(2));
		}

		for(let tagName in aux) {
			res.classification.push({tagName: tagName, value: Number(aux[tagName].toFixed(2))});
		}
		res.classification = Filters.orderAlphabetically(res.classification, 'value', true).reverse();

		return res;
	}
}