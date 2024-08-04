class Moment {
  #hoursInDay = 24;
  #minutesInHour = 60;
  #secondsInMinute = 60;
  #millisecondsInSecond = 1_000;

  constructor() {
    this.secondsInDay =
      this.#hoursInDay *
      this.#minutesInHour *
      this.#secondsInMinute *
      this.#millisecondsInSecond;
  }

  get secondsPassedToday() {
    const currentDate = new Date();
    const startOfCurrentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    );
    const millisecondsSinceStartOfDay = currentDate - startOfCurrentDate;
    return Math.floor(millisecondsSinceStartOfDay / this.#millisecondsInSecond);
  }
}

class NumberFormatter {
  #currency = "USD";
  #formatter;
  #locale = "en-US";

  constructor() {
    this.#formatter = new Intl.NumberFormat(this.#locale, {
      currency: this.#currency,
      maximumFractionDigits: 0,
      style: "currency",
    });
  }

  format(value) {
    return this.#formatter.format(value);
  }
}

class HtmlElementReplacer {
  #element;

  constructor(element) {
    this.#element = element;
  }

  replace(data) {
    this.#element.innerHTML = data;
  }
}

class DebtUrlBuilder {
  #base =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny";
  #query = {
    sort: "-record_date",
    "page[number]": "1",
    "page[size]": "100",
  };

  constructor() {
    this.url = this.#build(this.#base, this.#query);
  }

  #build() {
    const url = new URL(this.#base);
    for (let key of Object.keys(this.#query)) {
      url.searchParams.set(key, this.#query[key]);
    }
    return url;
  }
}

class DebtService {
  #builder;
  #response;

  constructor() {
    this.#builder = new DebtUrlBuilder();
    this.#response = {
      error: null,
      data: null,
    };
  }

  get response() {
    return {
      ...this.#response,
      data:
        this.#response.data?.map((item) => Number(item.tot_pub_debt_out_amt)) ??
        [],
    };
  }

  async fetch() {
    try {
      const response = await fetch(this.#builder.url);
      const { data } = await response.json();
      this.#changeResponse({ data });
    } catch (error) {
      this.#changeResponse({ error: "Ошибка загрузки" });
      throw error;
    }
  }

  #changeResponse(payload) {
    this.#response = { ...this.#response, ...payload };
  }
}

class Debt extends DebtService {
  #moment;

  constructor() {
    super();

    this.#moment = new Moment();
  }

  get status() {
    return this.response.error;
  }

  get #values() {
    const [debtOfToday, debtOfYesterday] = this.response.data;
    const closestDebt = this.response.data
      .slice(1)
      .find((item) => debtOfToday > item);
    return [debtOfToday, closestDebt ?? debtOfYesterday];
  }

  calculate() {
    const [debtOfToday, debtOfYesterday] = this.#values;
    const debtPerSecond =
      (debtOfToday - debtOfYesterday) / this.#moment.secondsInDay;
    const debtSinceStartOfDay = this.#moment.secondsPassedToday * debtPerSecond;
    return debtOfToday + debtSinceStartOfDay;
  }
}

class App {
  #interval = 1_000;

  init() {
    const app = document.getElementById("app");

    this.#mount(app);
    this.#listen(() => {
      const element = document.getElementById("content");

      this.#handle(element);
    });
  }

  #mount(element) {
    const html = `
      <div class="block">
        <div class="block__wrapper wrapper">
          <h1 class="wrapper__title">Внешний долг США</h1>
          <div id="content" class="wrapper__content">Загружаем госдолг...</div>
        </div>
      </div>
    `;
    const replacer = new HtmlElementReplacer(element);
    replacer.replace(html);
  }

  #listen(callback) {
    window.addEventListener("DOMContentLoaded", callback);
  }

  async #handle(element) {
    const debt = new Debt();
    const replacer = new HtmlElementReplacer(element);

    await this.#fetch(
      () => debt.fetch(),
      () => replacer.replace(debt.status)
    );

    setInterval(() => {
      const formatter = new NumberFormatter();

      replacer.replace(formatter.format(debt.calculate()));
    }, this.#interval);
  }

  async #fetch(callback, fallback) {
    try {
      await callback();
    } catch (error) {
      fallback();
      throw error;
    }
  }
}

const app = new App();

app.init();
