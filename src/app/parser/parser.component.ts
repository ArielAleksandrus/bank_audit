import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faCheck, faFileArrowUp } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';

import { IncomeSumComponent } from '../balance/income-sum/income-sum.component';
import { IncomeComponent } from '../balance/income/income.component';
import { BoletoComponent } from '../balance/boleto/boleto.component';
import { PurchaseComponent } from '../balance/purchase/purchase.component';

import { AiParser } from '../shared/parsers/ai-parser';

import { Company } from '../shared/models/company';
import { Boleto } from '../shared/models/boleto';
import { Income } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';

import { ApiService } from '../shared/services/api.service';

import { parseApiError } from '../shared/helpers/api-errors';
import { BRAZILIAN_BANKS } from '../shared/helpers/brazilian-banks';

// There is no more bank-specific frontend parsing: every file, whatever the
// bank, goes to the API, which tries a stored parser and falls back to an
// AI-discovered one (see ExtratoParserService on the backend). The bank
// picker below only feeds that lookup a hint - it never decides how the
// file gets parsed.
const ACCEPTED_EXTENSIONS = ["ofx", "csv", "xls", "xlsx"];

@Component({
  selector: 'app-parser',
  imports: [
    CommonModule,
    FormsModule,
    FaIconComponent,
    NgSelectModule,
    IncomeSumComponent,
    IncomeComponent,
    BoletoComponent,
    PurchaseComponent
  ],
  templateUrl: './parser.component.html',
  styleUrl: './parser.component.scss'
})
export class ParserComponent implements OnInit, OnDestroy {
  company: Company = {id: -1} as Company;

  bankOptions = BRAZILIAN_BANKS;
  selectedBank?: string;

  parser: AiParser = new AiParser();

  sending: boolean = false;
  sendingCount: number = 0;

  uploading: boolean = false;
  uploadPercent: number = 0;
  parsing: boolean = false;

  dragOver: boolean = false;
  fileError: string = '';
  extratoFile?: File;
  extratoId?: number;

  comprovanteText: string = '';
  comprovanteSent: boolean = false;
  suppliersMissing: boolean = false;

  showFeedbackModal: boolean = false;
  feedbackGiven?: 'up'|'down';

  private static readonly POLL_GIVEUP_MS = 15 * 60 * 1000;
  // Ask for a thumbs up/down once the user has had a moment to actually look
  // at the parsed result, not the instant it appears on screen.
  private static readonly FEEDBACK_DELAY_MS = 50 * 1000;
  // Parsing runs entirely server-side (a Sidekiq job) - a page reload must
  // not lose it. We persist just enough here to reattach to the same
  // extrato and resume polling on load.
  private static readonly PENDING_EXTRATO_KEY = 'ncontas_pending_extrato';
  private pollTimer?: ReturnType<typeof setTimeout>;
  private pollStartedAt = 0;
  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  backIcon = faArrowLeft;
  uploadIcon = faFileArrowUp;
  checkIcon = faCheck;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit() {
    // companyGuard has already validated the company and set the auth headers.
    this._loadCompany();
    this.resumePendingExtrato();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.stopPoll();
    this.stopFeedbackTimer();
  }

  get busy(): boolean {
    return this.uploading || this.parsing;
  }

  get hasResults(): boolean {
    return this.parser.incomes.length > 0 || this.parser.purchases.length > 0 || this.parser.boletos.length > 0;
  }

  get showComprovantes(): boolean {
    return this.hasResults && !this.busy && (this.parser.allowsComprovantes || this.genericPurchaseHint);
  }

  get genericPurchaseHint(): boolean {
    if(this.suppliersMissing)
      return true;
    // Boletos carry generic names ("DÉB.TIT.COMPE EFETIVADO") at least as
    // often as purchases do, and parser.parseComprovantes() enriches both -
    // so this hint has to look at both too.
    const rows: {supplier_name: string}[] = [...this.parser.purchases, ...this.parser.boletos];
    const groups = new Map<string, number>();
    let genericCount = 0;
    for(const row of rows) {
      if(!this.parser.isGenericSupplier(row.supplier_name))
        continue;
      genericCount += 1;
      const key = (row.supplier_name || "").trim().toLowerCase() || "(vazio)";
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    if(rows.length > 0 && genericCount / rows.length >= 0.6)
      return true;
    return [...groups.values()].some(count => count > 10);
  }

  selectOutros() {
    if(this.busy || this.extratoFile)
      return;
    this.selectedBank = 'outros';
  }

  changeBank() {
    if(this.busy)
      return;
    this.reset();
  }

  retryUpload() {
    if(this.busy || !this.extratoFile)
      return;
    this.processFile(this.extratoFile);
  }

  back() {
    const slug = this.company?.slug || Company.slugify(this.company?.name);
    this.router.navigate(['/', slug, 'dashboard']);
  }

  onDragOver(evt: DragEvent) {
    evt.preventDefault();
    if(!this.busy && !this.extratoFile)
      this.dragOver = true;
  }
  onDragLeave() {
    this.dragOver = false;
  }
  onDrop(evt: DragEvent) {
    evt.preventDefault();
    this.dragOver = false;
    if(this.busy || this.extratoFile)
      return;
    const file = evt.dataTransfer?.files?.[0];
    if(file)
      this.processFile(file);
  }

  extratoFileChanged(evt: any) {
    const file: File = evt.target.files?.[0];
    if(file)
      this.processFile(file);
  }

  processFile(file: File) {
    const extension = (file.name.split(".").pop() || "").toLowerCase();

    this.fileError = "";
    this.comprovanteSent = false;
    this.suppliersMissing = false;
    this.showFeedbackModal = false;
    this.feedbackGiven = undefined;
    this.stopFeedbackTimer();
    this.clearPendingExtrato();

    if(!ACCEPTED_EXTENSIONS.includes(extension)) {
      this.fileError = "Formatos aceitos: OFX, CSV, XLS ou XLSX";
      if(this.fileInput)
        this.fileInput.nativeElement.value = "";
      return;
    }

    this.parser.applyResult({});
    this.extratoFile = file;
    this.extratoId = undefined;
    this.uploading = true;
    this.uploadPercent = 0;

    this.api.uploadFile("extratos", file, "file", {
      bank: this.selectedBank || "outros",
      file_format: extension
    }, (percent: number) => {
      if(!this.destroyed)
        this.uploadPercent = percent;
    }).subscribe(
      (res: any) => {
        if(this.destroyed)
          return;
        this.uploading = false;
        if(!res || !res.id) {
          this.fileError = "Não foi possível enviar o extrato";
          return;
        }
        this.extratoId = res.id;
        this.parsing = true;
        this.pollStartedAt = Date.now();
        this.savePendingExtrato();
        this.pollExtrato(res.id, 0);
      },
      (err: any) => {
        if(this.destroyed)
          return;
        this.uploading = false;
        this.fileError = parseApiError(err, "Não foi possível enviar o extrato");
      }
    );
  }

  private pollExtrato(id: number, attempt: number) {
    if(this.destroyed)
      return;
    if(Date.now() - this.pollStartedAt > ParserComponent.POLL_GIVEUP_MS) {
      this.parsing = false;
      this.clearPendingExtrato();
      this.fileError = 'A análise está demorando demais. Tente novamente.';
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.api.show('extratos', id).subscribe(
        (res: any) => {
          if(this.destroyed)
            return;
          if(res.status == 'parsed') {
            this.applyParsedResult(res);
            return;
          }
          if(res.status == 'failed') {
            this.parsing = false;
            this.clearPendingExtrato();
            this.fileError = res.error || 'Não foi possível analisar o extrato';
            return;
          }
          this.pollExtrato(id, attempt + 1);
        },
        (err: any) => {
          if(this.destroyed)
            return;
          this.parsing = false;
          this.clearPendingExtrato();
          this.fileError = parseApiError(err, 'Erro ao consultar o extrato');
        }
      );
    }, attempt == 0 ? 800 : 2000);
  }

  private applyParsedResult(res: any) {
    this.parser.applyResult(res);
    this.suppliersMissing = res.has_supplier_names === false;
    this.parsing = false;
    this.clearPendingExtrato();
    this.checkIfBoletosExist();
    this.checkIfIncomesExist();
    this.checkIfPurchasesExist();
    this.startFeedbackTimer();
  }

  private stopPoll() {
    if(this.pollTimer)
      clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
  }

  // Gives the user a moment to actually look at the result before asking
  // whether it's right. A thumbs down just logs that this parse attempt (this
  // file + whichever GeneratedParser produced it) was disliked - the AI only
  // gets asked to refine the parser later, when Salvar is clicked and there's
  // real user-corrected data to refine it against (see refineParserAfterSave).
  private startFeedbackTimer() {
    this.stopFeedbackTimer();
    this.showFeedbackModal = false;
    this.feedbackGiven = undefined;
    this.feedbackTimer = setTimeout(() => {
      if(!this.destroyed && this.hasResults && !this.feedbackGiven)
        this.showFeedbackModal = true;
    }, ParserComponent.FEEDBACK_DELAY_MS);
  }

  private stopFeedbackTimer() {
    if(this.feedbackTimer)
      clearTimeout(this.feedbackTimer);
    this.feedbackTimer = undefined;
  }

  giveFeedback(kind: 'up'|'down') {
    this.feedbackGiven = kind;
    this.showFeedbackModal = false;
    if(kind == 'down')
      this.logNegativeFeedback();
  }

  dismissFeedbackModal() {
    this.showFeedbackModal = false;
  }

  private logNegativeFeedback() {
    if(!this.extratoId)
      return;
    this.api.req("extratos", {}, { member: { id: this.extratoId, value: "failures" } }, "post").subscribe(
      () => {},
      (err: any) => console.error(err)
    );
  }

  private savePendingExtrato() {
    if(!this.extratoId)
      return;
    try {
      localStorage.setItem(ParserComponent.PENDING_EXTRATO_KEY, JSON.stringify({
        id: this.extratoId,
        companyId: this.company?.id,
        startedAt: this.pollStartedAt,
        bank: this.selectedBank
      }));
    } catch { /* private mode / storage disabled - resuming after reload just won't work */ }
  }

  private clearPendingExtrato() {
    try { localStorage.removeItem(ParserComponent.PENDING_EXTRATO_KEY); } catch { /* ignore */ }
  }

  private resumePendingExtrato() {
    let raw: string | null = null;
    try { raw = localStorage.getItem(ParserComponent.PENDING_EXTRATO_KEY); } catch { return; }
    if(!raw)
      return;

    let saved: {id?: number, companyId?: number, startedAt?: number, bank?: string};
    try { saved = JSON.parse(raw); } catch { this.clearPendingExtrato(); return; }

    if(!saved.id || !saved.startedAt || saved.companyId !== this.company?.id)
      return;
    if(Date.now() - saved.startedAt > ParserComponent.POLL_GIVEUP_MS) {
      this.clearPendingExtrato();
      return;
    }

    this.selectedBank = saved.bank;
    this.extratoId = saved.id;
    this.pollStartedAt = saved.startedAt;
    this.parsing = true;
    this.pollExtrato(saved.id, 0);
  }

  private reset() {
    this.stopPoll();
    this.stopFeedbackTimer();
    this.clearPendingExtrato();
    this.selectedBank = undefined;
    this.parser = new AiParser();
    this.extratoFile = undefined;
    this.extratoId = undefined;
    this.uploading = false;
    this.uploadPercent = 0;
    this.parsing = false;
    this.fileError = '';
    this.comprovanteText = '';
    this.comprovanteSent = false;
    this.suppliersMissing = false;
    this.showFeedbackModal = false;
    this.feedbackGiven = undefined;
    if(this.fileInput)
      this.fileInput.nativeElement.value = '';
  }

  setComprovante() {
    const value = (this.comprovanteText || "").trim();
    if(!value)
      return;

    this.parser.parseComprovantes(value);
    this.comprovanteSent = true;
    this.checkIfBoletosExist();
  }

  changedIncome(evt: {mode: 'create'|'edit'|'destroy', income: Income}) {
    this.parser.recalculateIncome();
    if(evt.mode == 'destroy')
      this.removeIncome(evt.income);
  }
  removeIncome(income: Income) {
    if(income.id > 0) {
      this.api.destroy('incomes', income.id).subscribe(
        (res: any) => {
          console.log(res);
        },
        (err: any) => {
          alert("Nao foi possivel remover a receita no servidor");
          console.error(err, income);
        }
      );
    }
  }

  send() {
    this.sendingCount = this.parser.boletos.length + this.parser.purchases.length + this.parser.incomes.length;
    this.sending = true;
    this.saveBoletos().then(res => {
      this.sendingCount -= this.parser.boletos.length;
      this.saveIncomes().then(res2 => {
        this.sendingCount -= this.parser.incomes.length;
        this.savePurchases().then(res3 => {
          this.sendingCount -= this.parser.purchases.length;
          this.sending = false;
          this.refineParserAfterSave();
        })
      })
    });
  }

  saveBoletos(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      Boleto.sendArray(this.api, this.parser.boletos).then(res => {
        this.parser.boletos = res;
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }
  saveIncomes(): Promise<boolean>  {
    return new Promise<boolean>((resolve, reject) => {
      Income.sendArray(this.api, this.parser.incomes).then(res => {
        // Rows the server reclassified as a same-titularidade transfer (see
        // income_type "movimentacao_entre_contas") no longer belong here.
        this.parser.incomes = res.filter(income => income.auxStatus != 'converted');
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }

  savePurchases(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      Purchase.sendArray(this.api, this.parser.purchases).then(res => {
        // Rows the server reclassified as a same-titularidade transfer (see
        // payment_type "movimentacao_entre_contas") no longer belong here.
        this.parser.purchases = res.filter(purchase => purchase.auxStatus != 'converted');
        resolve(true);
      }).catch(err => {
        reject(err);
      })
    });
  }

  // Sends the user's corrected lançamentos back to the extrato so the
  // AI-generated (or stored) parser functions for this bank+format get
  // refined - but only when the user actually flagged the parse as wrong.
  // A thumbs up (or no feedback at all) means the parser already did fine,
  // so there's no reason to spend an AI call refining it.
  private refineParserAfterSave() {
    if(!this.extratoId || this.feedbackGiven != 'down')
      return;
    const payload = {
      incomes: this.parser.incomes,
      purchases: this.parser.purchases,
      boletos: this.parser.boletos
    };
    this.api.req("extratos", payload, { member: { id: this.extratoId, value: "refine" } }, "post").subscribe(
      () => {},
      (err: any) => console.error(err)
    );
  }

  // These "does this already exist" lookups run right after parsing and
  // again after setComprovante() edits the boletos in place - both async
  // (tag-suggestion lookups over every supplier name can take a couple of
  // seconds). Without a guard, whichever call happens to resolve LAST wins,
  // so the earlier pre-comprovante call finishing after the later one would
  // silently overwrite the corrected names with the original generic ones.
  // A generation counter per array makes a stale resolution a no-op instead.
  private boletosCheckGen = 0;
  private purchasesCheckGen = 0;
  private incomesCheckGen = 0;

  checkIfBoletosExist() {
    const gen = ++this.boletosCheckGen;
    Boleto.arrayExists(this.api, this.parser.boletos).then((boletos: Boleto[]) => {
      if(gen == this.boletosCheckGen)
        this.parser.boletos = boletos;
    });
  }
  checkIfPurchasesExist() {
    const gen = ++this.purchasesCheckGen;
    Purchase.arrayExists(this.api, this.parser.purchases).then((purchases: Purchase[]) => {
      if(gen == this.purchasesCheckGen)
        this.parser.purchases = purchases;
    });
  }
  checkIfIncomesExist() {
    const gen = ++this.incomesCheckGen;
    Income.arrayExists(this.api, this.parser.incomes).then((incomes: Income[]) => {
      if(gen == this.incomesCheckGen)
        this.parser.incomes = incomes;
    });
  }

  private _loadCompany() {
    let loaded = Company.loadCompany();
    if(loaded && loaded.token) {
      this.company = loaded;
    } else {
      location.href = '/login';
    }
  }
}
