import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { jsPDF } from "jspdf";
import { autoTable } from 'jspdf-autotable';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowTrendUp,
  faArrowTrendDown,
  faFileInvoiceDollar,
  faChartPie,
  faFileLines,
  faTags,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

import { ApiService } from '../shared/services/api.service';
import { QueryHelpers } from '../shared/helpers/query-helpers';

import { Company } from '../shared/models/company';
import { User } from '../shared/models/user';
import { Boleto } from '../shared/models/boleto';
import { Income, IncomeSummary } from '../shared/models/income';
import { Purchase } from '../shared/models/purchase';
import { Supplier } from '../shared/models/supplier';
import { Tag } from '../shared/models/tag';

import { BoletoComponent } from '../balance/boleto/boleto.component';
import { IncomeSumComponent } from '../balance/income-sum/income-sum.component';
import { IncomeComponent } from '../balance/income/income.component';
import { PurchaseComponent } from '../balance/purchase/purchase.component';
import { TagChartComponent } from './tag-chart/tag-chart.component';
import { TagManagerComponent } from './tag-manager/tag-manager.component';
import { TagDescriptionComponent } from '../shared/components/tag-description/tag-description.component';

import { Reports, TagClassification, DescribedReport } from '../shared/parsers/reports';

import { Utils } from '../shared/helpers/utils';

@Component({
  selector: 'app-report',
  imports: [CommonModule, FormsModule, FaIconComponent,
            BoletoComponent, IncomeComponent, IncomeSumComponent, PurchaseComponent,
            TagChartComponent, TagManagerComponent, TagDescriptionComponent],
  templateUrl: './report.component.html',
  styleUrl: './report.component.scss'
})
export class ReportComponent {
  // one company for the normal '/:companySlug/relatorio' route, several for
  // the combined '/relatorio-multi' view
  companies: Company[] = [];
  // true when every company the user has was picked (e.g. "Todas as Empresas")
  viewingAllCompanies: boolean = false;

  incomeIcon = faArrowTrendUp;
  purchaseIcon = faArrowTrendDown;
  boletoIcon = faFileInvoiceDollar;
  chartsIcon = faChartPie;
  reportIcon = faFileLines;
  tagsIcon = faTags;
  backIcon = faArrowLeft;

  boletos: Boleto[] = [];
  boletosLoaded: boolean = false;
  incomes: Income[] = [];
  incomesLoaded: boolean = false;
  purchases: Purchase[] = [];
  purchasesLoaded: boolean = false;
  suppliers: Supplier[] = [];

  // company-wide, not scoped to the selected date range
  tags: Tag[] = [];

  from: string;
  to: string;
  fromPtbr: string;
  toPtbr?: string;

  reports?: Reports;
  boletoTagData?: TagClassification;
  purchaseTagData?: TagClassification;
  incomeSummary?: IncomeSummary;

  selection: 'none'|'reports'|'incomes'|'purchases'|'boletos'|'charts'|'tags' = 'none';

  selectedTag?: string;
  selectedPurchases: Purchase[] = [];

  describedReport?: DescribedReport;
  printDescribedReportTable: boolean = false;

  constructor(private api: ApiService,
              private route: ActivatedRoute,
              private router: Router) {

    const snapshot = this.route.snapshot;

    this.from = snapshot.queryParams['desde'];
    this.fromPtbr = (Utils.dateToString(this.from, false) || '01/01/0001').split(" ")[0];
    this.to = snapshot.queryParams['ate'];
    if(this.to)
      this.toPtbr = (Utils.dateToString(this.to, false) || "").split(" ")[0];

    if(snapshot.paramMap.get('companySlug')) {
      // companyGuard has already validated the company and set the auth headers.
      this.companies = [Company.loadCompany()];
    } else {
      // selectedCompaniesGuard has already validated the selection.
      this.companies = Company.loadSelectedCompanies();
      this.viewingAllCompanies = Company.loadSelectedCompaniesAreAll();
    }

    // Company/boleto/income/purchase queries pass their own per-company auth
    // explicitly (see _queryAcrossCompanies) and don't depend on this. It's
    // just a reasonable default for anything else on the page that still
    // reads the shared auth state (e.g. the Tags section, single-company only).
    const user = User.loadUser();
    if(this.companies[0]) {
      const authHeaders: any = { token: this.companies[0].token };
      if(user?.token)
        authHeaders['User-Token'] = user.token;
      this.api.setAuth(authHeaders);
    }
  }

  get isSingleCompany(): boolean {
    return this.companies.length === 1;
  }

  // Buyers can add incomes but their reports are limited to boletos and
  // purchases - hidden whenever any of the selected companies has them
  // as a buyer, single or combined report alike.
  get canViewIncomes(): boolean {
    return !this.companies.some(c => c.isBuyer);
  }

  get companyNamesLabel(): string {
    if(this.viewingAllCompanies) {
      return 'Todas as Empresas';
    }
    return this.companies.map(c => c.name).join(', ');
  }

  ngOnInit() {
    this.queryEntries();
    if(this.isSingleCompany) {
      this.loadTags();
    }
  }

  selectSection(section: 'reports'|'incomes'|'purchases'|'boletos'|'charts'|'tags') {
    this.selection = this.selection == section ? 'none' : section;
  }

  goToCompanies() {
    this.router.navigate(['/companies']);
  }

  queryEntries() {
    this.boletoQuery();
    this.purchaseQuery();
    if(this.canViewIncomes) {
      this.incomeQuery();
    } else {
      this.incomes = [];
      this.incomeSummary = Income.calculateIncomeSummary([]);
      this.incomesLoaded = true;
      this.setReports();
    }
  }

  loadTags() {
    Tag.loadTags(this.api).then((res: Tag[]) => {
      this.tags = res;
    });
  }

  setReports() {
    if(!this.incomesLoaded || !this.purchasesLoaded || !this.boletosLoaded)
      return;

    this.reports = new Reports(this.incomes, this.purchases, this.boletos);
    this.boletoTagData = this.reports.boletoTagChart(this.boletos);
    this.purchaseTagData = this.reports.purchaseTagChart(this.purchases);
  }

  // Runs the same indexAll query once per selected company (switching the
  // auth token each time) and concatenates the results into one array, so
  // a combined report is just this app's normal single-company queries run
  // N times and merged client-side.
  private _queryAcrossCompanies<T>(resource: string, params: any, fromJsonArray: (arr: any[]) => T[]): Promise<T[]> {
    return new Promise((resolve) => {
      let combined: T[] = [];
      let remaining = this.companies.length;
      if(remaining === 0) {
        resolve(combined);
        return;
      }

      for(let company of this.companies) {
        // Passed explicitly (not via api.setAuth) because these run
        // concurrently, one per company: indexAll recurses asynchronously
        // as each page comes back, and by then the shared customAuth may
        // already belong to a different company's in-flight fetch - every
        // page after the first would silently use the wrong token.
        const user = User.loadUser();
        let authHeaders = new HttpHeaders(user?.token ? { token: company.token, 'User-Token': user.token } : { token: company.token });

        // indexAll also mutates its params object as it paginates, so each
        // company needs its own copy to avoid racing the others there too.
        this.api.indexAll(resource, Utils.clone(params), {}, 1, {}, authHeaders).subscribe(
          (res: any) => {
            combined = combined.concat(fromJsonArray(res[resource]));
            remaining--;
            if(remaining === 0) {
              resolve(combined);
            }
          }
        );
      }
    });
  }

  boletoQuery() {
    let params: any = {
      q: {
        "payment_date": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("payment_date", this.from, this.to);
    }

    this._queryAcrossCompanies('boletos', params, Boleto.fromJsonArray).then((boletos: Boleto[]) => {
      this.boletos = boletos;
      this.boletosLoaded = true;
      this.setReports();
    });
  }
  incomeQuery() {
    let params: any = {
      q: {
        "date_received": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("date_received", this.from, this.to);
    }

    this._queryAcrossCompanies('incomes', params, Income.fromJsonArray).then((incomes: Income[]) => {
      this.incomes = incomes;
      this.incomeSummary = Income.calculateIncomeSummary(this.incomes);
      this.incomesLoaded = true;
      this.setReports();
    });
  }
  purchaseQuery() {
    let params: any = {
      q: {
        "purchase_date": this.from
      }
    };
    if(this.to) {
      params = QueryHelpers.queryIntervalParams("purchase_date", this.from, this.to);
    }

    this._queryAcrossCompanies('purchases', params, Purchase.fromJsonArray).then((purchases: Purchase[]) => {
      this.purchases = purchases;
      this.purchasesLoaded = true;
      this.setReports();
    });
  }

  purchaseChartSelection(evt: {tagName: string, value: number}) {
    this.selectedPurchases = [];
    this.selectedTag = evt.tagName;

    for(let purchase of this.purchases) {
      if(Utils.findById(evt.tagName, purchase.tags, 'name'))
        this.selectedPurchases.push(purchase);
    }
    setTimeout(() => {
      let el = document.getElementById("selection");
      if(el)
        el.scrollIntoView({behavior: 'smooth'});
    }, 150)
  }

  generateReport() {
    if(this.reports) {
      this.describedReport = this.reports.describedReport();
    }
  }

  print(htmlId: string) {
    let el = document.getElementById(htmlId);
    if(!el)
      return;

    this.printDescribedReportTable = true;
    setTimeout(() => {
      window.print();
    }, 200);
    setTimeout(() => {
      //this.printDescribedReportTable = false;
    }, 3000);
  }
}
