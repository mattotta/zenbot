#!/usr/bin/env node

/* Zenbot 4 Genetic Backtester
 * Clifford Roche <clifford.roche@gmail.com>
 * 07/01/2017
 *
 * Example: ./darwin.js --selector="bitfinex.ETH-USD" --days=10 --currency_capital=5000 --use_strategies=(all|macd,trend_ema)
 */

let shell = require('shelljs');
let parallel = require('run-parallel-limit');
let json2csv = require('json2csv');
let roundp = require('round-precision');
let fs = require('fs');
let GeneticAlgorithmCtor = require('geneticalgorithm');
let StripAnsi = require('strip-ansi');
let moment = require('moment');
let tb = require('timebucket');

let Phenotypes = require('./phenotype.js');

let VERSION = 'Zenbot 4 Genetic Backtester v0.2';

let PARALLEL_LIMIT = (process.env.PARALLEL_LIMIT && +process.env.PARALLEL_LIMIT) || require('os').cpus().length;

let TREND_EMA_MIN = 1;
let TREND_EMA_MAX = 240;

let OVERSOLD_RSI_MIN = 0;
let OVERSOLD_RSI_MAX = 50;

let OVERBOUGHT_RSI_MIN = 50;
let OVERBOUGHT_RSI_MAX = 100;

let RSI_PERIODS_MIN = 1;
let RSI_PERIODS_MAX = 240;

let iterationCount = 0;

console.log(`\n--==${VERSION}==--`);
console.log(new Date().toUTCString() + `\n`);

let argv = require('yargs').argv;

let selector = (argv.selector) ? argv.selector : 'gdax.BTC-EUR';
let selectors = selector.split(',')

let force_period_length = (argv.period_length) ? argv.period_length : false;

let runCommand = (taskStrategyName, phenotype, cb) => {
  if (force_period_length !== false) {
    phenotype.period_length = force_period_length;
  }
  let commonArgs = `--strategy=${taskStrategyName} --period_length=${phenotype.period_length} --sell_stop_pct=${phenotype.sell_stop_pct} --buy_stop_pct=${phenotype.buy_stop_pct} --profit_stop_enable_pct=${phenotype.profit_stop_enable_pct} --profit_stop_pct=${phenotype.profit_stop_pct} --order_type_stop=${phenotype.order_type_stop}`;
  let strategyArgs = {
    crossover_vwap: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --emalen1=${phenotype.emalen1} --vwap_length=${phenotype.vwap_length} --vwap_max=${phenotype.vwap_max} --min_diff_pct=${phenotype.min_diff_pct}`,
    cci_srsi: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --min_periods=${phenotype.min_periods} --cci_periods=${phenotype.rsi_periods} --rsi_periods=${phenotype.srsi_periods} --srsi_periods=${phenotype.srsi_periods} --srsi_k=${phenotype.srsi_k} --srsi_d=${phenotype.srsi_d} --oversold_rsi=${phenotype.oversold_rsi} --overbought_rsi=${phenotype.overbought_rsi} --oversold_cci=${phenotype.oversold_cci} --overbought_cci=${phenotype.overbought_cci} --constant=${phenotype.constant} --reversed=${phenotype.reversed} --ema_acc=${phenotype.ema_acc}`,
    srsi_macd: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --rsi_periods=${phenotype.rsi_periods} --srsi_periods=${phenotype.srsi_periods} --srsi_k=${phenotype.srsi_k} --srsi_d=${phenotype.srsi_d} --oversold_rsi=${phenotype.oversold_rsi} --overbought_rsi=${phenotype.overbought_rsi} --ema_short_period=${phenotype.ema_short_period} --ema_long_period=${phenotype.ema_long_period} --signal_period=${phenotype.signal_period} --up_trend_threshold=${phenotype.up_trend_threshold} --down_trend_threshold=${phenotype.down_trend_threshold}`,
    macd: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --ema_short_period=${phenotype.ema_short_period} --ema_long_period=${phenotype.ema_long_period} --signal_period=${phenotype.signal_period} --up_trend_threshold=${phenotype.up_trend_threshold} --down_trend_threshold=${phenotype.down_trend_threshold} --overbought_rsi_periods=${phenotype.overbought_rsi_periods} --overbought_rsi=${phenotype.overbought_rsi}`,
    multi_ema: `--ema_periods_weak_down=${phenotype.ema_periods_weak_down} --ema_periods_weak_up=${phenotype.ema_periods_weak_up} --ema_periods_strong_down=${phenotype.ema_periods_strong_down} --ema_periods_strong_up=${phenotype.ema_periods_strong_up} --neutral_rate_weak_down=${phenotype.neutral_rate_weak_down} --neutral_rate_weak_up=${phenotype.neutral_rate_weak_up} --neutral_rate_strong_down=${phenotype.neutral_rate_strong_down} --neutral_rate_strong_up=${phenotype.neutral_rate_strong_up} --neutral_rate_min_weak_down=${phenotype.neutral_rate_min_weak_down} --neutral_rate_min_weak_up=${phenotype.neutral_rate_min_weak_up} --neutral_rate_min_strong_down=${phenotype.neutral_rate_min_strong_down} --neutral_rate_min_strong_up=${phenotype.neutral_rate_min_strong_up} --decision=${phenotype.decision} --order_type_rsi=taker --order_type_weak=maker --order_type_strong=taker --oversold_rsi=${phenotype.oversold_rsi} --overbought_rsi=${phenotype.overbought_rsi} --rsi_periods_oversold=${phenotype.rsi_periods_oversold} --rsi_periods_overbought=${phenotype.rsi_periods_overbought}`,
    neural: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --activation_1_type=${phenotype.activation_1_type} --neurons_1=${phenotype.neurons_1} --depth=${phenotype.depth} --momentum=${phenotype.momentum} --decay=${phenotype.decay} --min_predict=${phenotype.min_predict} --learns=${phenotype.learns}`,
    rsi: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --rsi_periods=${phenotype.rsi_periods} --oversold_rsi=${phenotype.oversold_rsi} --overbought_rsi=${phenotype.overbought_rsi} --rsi_recover=${phenotype.rsi_recover} --rsi_drop=${phenotype.rsi_drop} --rsi_divisor=${phenotype.rsi_divisor}`,
    sar: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --sar_af=${phenotype.sar_af} --sar_max_af=${phenotype.sar_max_af}`,
    speed: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --baseline_periods=${phenotype.baseline_periods} --trigger_factor=${phenotype.trigger_factor}`,
    trend_ema: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --trend_ema=${phenotype.trend_ema} --oversold_rsi=${phenotype.oversold_rsi} --overbought_rsi=${phenotype.overbought_rsi} --rsi_periods=${phenotype.rsi_periods} --neutral_rate=${phenotype.neutral_rate} --neutral_rate_min=${phenotype.neutral_rate_min} --reversed=${phenotype.reversed}`,
    trust_distrust: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --sell_threshold=${phenotype.sell_threshold} --sell_threshold_max=${phenotype.sell_threshold_max} --sell_min=${phenotype.sell_min} --buy_threshold=${phenotype.buy_threshold} --buy_threshold_max=${phenotype.buy_threshold_max} --greed=${phenotype.greed}`,
    ta_macd: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --ema_short_period=${phenotype.ema_short_period} --ema_long_period=${phenotype.ema_long_period} --signal_period=${phenotype.signal_period} --up_trend_threshold=${phenotype.up_trend_threshold} --down_trend_threshold=${phenotype.down_trend_threshold} --overbought_rsi_periods=${phenotype.overbought_rsi_periods} --overbought_rsi=${phenotype.overbought_rsi}`,
    ta_ema: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --min_periods=${phenotype.min_periods} --trend_ema=${phenotype.trend_ema} --oversold_rsi=${phenotype.oversold_rsi} --oversold_rsi_periods=${phenotype.oversold_rsi_periods} --neutral_rate=auto_trend --neutral_rate_min=${phenotype.neutral_rate_min}`,
    dema: `--markdown_buy_pct=${phenotype.markdown_buy_pct} --markup_sell_pct=${phenotype.markup_sell_pct} --order_type=${phenotype.order_type} --ema_short_period=${phenotype.ema_short_period} --ema_long_period=${phenotype.ema_long_period} --signal_period=${phenotype.signal_period} --up_trend_threshold=${phenotype.up_trend_threshold} --down_trend_threshold=${phenotype.down_trend_threshold} --overbought_rsi_periods=${phenotype.overbought_rsi_periods} --overbought_rsi=${phenotype.overbought_rsi}`
  };
  let zenbot_cmd = process.platform === 'win32' ? 'zenbot.bat' : './zenbot.sh';
  let command = `${zenbot_cmd} sim ${phenotype.selector} ${simArgs.toString()} ${commonArgs} ${strategyArgs[taskStrategyName]}`;
  console.log(`[ ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${iterationCount++}/${populationSize * selectedStrategies.length} ] ${command}`);

  phenotype['sim'] = {};

  shell.exec(command, {
    silent: true,
    async: true
  }, (code, stdout, stderr) => {
    if (code) {
      console.error(command);
      console.error(stderr);
      return cb(null, null);
    }

    try {
      phenotype['sim'] = processOutput(stdout);
      phenotype.sim['selector'] = phenotype.selector;
      phenotype.sim['fitness'] = Phenotypes.fitness(phenotype);
    } catch (err) {
      console.log(`Bad output detected`, err.toString());
      console.log(stdout);
      console.log(err)
    }

    cb(null);
  });
};

let runUpdate = (days, selector) => {
  let zenbot_cmd = process.platform === 'win32' ? 'zenbot.bat' : './zenbot.sh';
  let command = `${zenbot_cmd} backfill --days=${days} ${selector}`;
  console.log(`Backfilling (might take some time) ...`);
  console.log(command);

  shell.exec(command, {
    silent: true,
    async: false
  });
};

let processOutput = output => {
  let jsonRegexp = /(\{[\s\S]*?\})\send balance/g;
  let endBalRegexp = /end balance: (\d+\.\d+) \(/g;
  let buyHoldRegexp = /buy hold: (\d+\.\d+) \(/g;
  let vsBuyHoldRegexp = /vs. buy hold: (-?\d+\.\d+)%/g;
  let wlRegexp = /win\/loss: (\d+)\/(\d+)/g;
  let errRegexp = /error rate: (.*)%/g;
  let feeRegexp = /fees: (\d+\.\d+)/g;

  let strippedOutput = StripAnsi(output);
  let output2 = strippedOutput.substr(strippedOutput.length - 4000);

  let rawParams = jsonRegexp.exec(output2)[1];
  let params = JSON.parse(rawParams);
  let endBalance = endBalRegexp.exec(output2)[1];
  let buyHold = buyHoldRegexp.exec(output2)[1];
  let vsBuyHold = vsBuyHoldRegexp.exec(output2)[1];
  let wlMatch = wlRegexp.exec(output2);
  let errMatch      = errRegexp.exec(output2);
  let feeMatch      = feeRegexp.exec(output2);
  let wins          = wlMatch !== null ? parseInt(wlMatch[1]) : 0;
  let losses        = wlMatch !== null ? parseInt(wlMatch[2]) : 0;
  let errorRate     = errMatch !== null ? parseInt(errMatch[1]) : 0;
  let fees          = feeMatch !== null ? feeMatch[1] : 0;
  let days = parseInt(params.days);

  let roi = roundp(
    ((endBalance - params.currency_capital) / params.currency_capital) * 100,
    3
  );

  let r = JSON.parse(rawParams.replace(/[\r\n]/g, ''));
  delete r.asset_capital;
  delete r.buy_pct;
  delete r.currency_capital;
  delete r.days;
  delete r.mode;
  delete r.order_adjust_time;
  delete r.population;
  delete r.population_data;
  delete r.sell_pct;
  delete r.start;
  delete r.end;
  delete r.stats;
  delete r.use_strategies;
  delete r.show_options;
  delete r.verbose;
  delete r.silent;
  r.selector = r.selector.normalized

  return {
    params: 'module.exports = ' + JSON.stringify(r),
    endBalance: parseFloat(endBalance),
    buyHold: parseFloat(buyHold),
    vsBuyHold: parseFloat(vsBuyHold),
    fees: fees,
    wins: wins,
    losses: losses,
    errorRate: parseFloat(errorRate),
    days: days,
    period_length: params.period_length ? params.period_length : params.period,
    order_type: params.order_type,
    roi: roi,
    wlRatio: losses > 0 ? roundp(wins / losses, 3) : 'Infinity',
    selector: params.selector,
    strategy: params.strategy,
    frequency: roundp((wins + losses) / days, 3)
  };
};

let Range = (min, max) => {
  let r = {
    type: 'int',
    min: min,
    max: max
  };
  return r;
};

let Range0 = (min, max) => {
  let r = {
    type: 'int0',
    min: min,
    max: max
  };
  return r;
};

let RangeFactor = (min, max, factor) => {
  let r = {
    type: 'intfactor',
    min: min,
    max: max,
    factor: factor
  };
  return r;
};

let RangeFloat = (min, max, precision = 0) => {
  let r = {
    type: 'float',
    min: min,
    max: max,
    precision: precision
  };
  return r;
};

let RangePeriod = (min, max, period) => {
  let r = {
    type: 'period',
    min: min,
    max: max,
    period: period
  };
  return r;
};

let RangeMakerTaker = () => {
  let r = {
    type: 'makertaker'
  };
  return r;
};

let RangeItems = (items) => {
  let r = {
    type: 'items',
    items: items
  };
  return r;
};

let strategies = {
  crossover_vwap: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    emalen1: Range(1, 300),
    vwap_length: Range(1, 300),
    vwap_max: RangeFactor(0, 100000, 10), // 0 disables this max cap. Test in increments of 10
    min_diff_pct: RangeFloat(0, 1),
  },
  cci_srsi: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    cci_periods: Range(1, 200),
    rsi_periods: Range(1, 200),
    srsi_periods: Range(1, 200),
    srsi_k: Range(1, 50),
    srsi_d: Range(1, 50),
    oversold_rsi: Range(1, 100),
    overbought_rsi: Range(1, 100),
    oversold_cci: Range(-100, 100),
    overbought_cci: Range(1, 100),
    constant: RangeFloat(0.001, 0.05),
    reversed: RangeItems(['none', 'both', 'side', 'trend']),
    ema_acc: RangeFloat(0, 1)
  },
  srsi_macd: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    rsi_periods: Range(1, 200),
    srsi_periods: Range(1, 200),
    srsi_k: Range(1, 50),
    srsi_d: Range(1, 50),
    oversold_rsi: Range(1, 100),
    overbought_rsi: Range(1, 100),
    ema_short_period: Range(1, 20),
    ema_long_period: Range(20, 100),
    signal_period: Range(1, 20),
    up_trend_threshold: Range(0, 20),
    down_trend_threshold: Range(0, 20)
  },
  macd: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    ema_short_period: Range(1, 20),
    ema_long_period: Range(20, 100),
    signal_period: Range(1, 20),
    up_trend_threshold: Range(0, 50),
    down_trend_threshold: Range(0, 50),
    overbought_rsi_periods: Range(1, 50),
    overbought_rsi: Range(20, 100)
  },
  multi_ema: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 'm'),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(0, 0),

    // -- strategy
    ema_periods_weak_down: Range(TREND_EMA_MIN, TREND_EMA_MAX),
    ema_periods_weak_up: Range(TREND_EMA_MIN, TREND_EMA_MAX),
    ema_periods_strong_down: Range(TREND_EMA_MIN, TREND_EMA_MAX),
    ema_periods_strong_up: Range(TREND_EMA_MIN, TREND_EMA_MAX),
    neutral_rate_weak_down: RangeItems([0, 'auto', 'auto_trend', 'auto_new']),
    neutral_rate_weak_up: RangeItems([0, 'auto', 'auto_trend', 'auto_new']),
    neutral_rate_strong_down: RangeItems([0, 'auto', 'auto_trend', 'auto_new']),
    neutral_rate_strong_up: RangeItems([0, 'auto', 'auto_trend', 'auto_new']),
    neutral_rate_min_weak_down: RangeFloat(0, 1, 4),
    neutral_rate_min_weak_up: RangeFloat(0, 1, 4),
    neutral_rate_min_strong_down: RangeFloat(0, 1, 4),
    neutral_rate_min_strong_up: RangeFloat(0, 1, 4),
    decision: RangeItems(['direct', 'direct-remember', 'after', 'after-remember']),
    rsi_periods_oversold: Range(RSI_PERIODS_MIN, RSI_PERIODS_MAX),
    rsi_periods_overbought: Range(RSI_PERIODS_MIN, RSI_PERIODS_MAX),
    oversold_rsi: RangeFloat(OVERSOLD_RSI_MIN, OVERSOLD_RSI_MAX, 2),
    overbought_rsi: RangeFloat(OVERBOUGHT_RSI_MIN, OVERBOUGHT_RSI_MAX, 2)
  },
  neural: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    neurons_1: Range(1, 200),
    activation_1_type: RangeItems(['sigmoid', 'tanh', 'relu']),
    depth: Range(1, 100),
    min_predict: Range(1, 100),
    momentum: Range(0, 100),
    decay: Range(1, 10),
    learns: Range(1, 200)
  },
  rsi: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    rsi_periods: Range(1, 200),
    oversold_rsi: Range(1, 100),
    overbought_rsi: Range(1, 100),
    rsi_recover: Range(1, 100),
    rsi_drop: Range(0, 100),
    rsi_divisor: Range(1, 10)
  },
  sar: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(2, 100),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    sar_af: RangeFloat(0.01, 1.0),
    sar_max_af: RangeFloat(0.01, 1.0)
  },
  speed: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 100),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    baseline_periods: Range(1, 5000),
    trigger_factor: RangeFloat(0.1, 10)
  },
  trend_ema: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(0, 0),

    // -- strategy
    trend_ema: Range(TREND_EMA_MIN, TREND_EMA_MAX),
    rsi_periods: Range(RSI_PERIODS_MIN, RSI_PERIODS_MAX),
    oversold_rsi: Range(OVERSOLD_RSI_MIN, OVERSOLD_RSI_MAX),
    overbought_rsi: Range(OVERBOUGHT_RSI_MIN, OVERBOUGHT_RSI_MAX),
    neutral_rate: RangeItems(['auto', 'auto_trend', 'auto_new']),
    neutral_rate_min: RangeFloat(0, 1),
    reversed: Range(0, 1)
  },
  trust_distrust: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 100),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    sell_threshold: Range(1, 100),
    sell_threshold_max: Range0(1, 100),
    sell_min: Range(1, 100),
    buy_threshold: Range(1, 100),
    buy_threshold_max: Range0(1, 100),
    greed: Range(1, 100)
  },
  ta_macd: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    // have to be minimum 2 because talib will throw an "TA_BAD_PARAM" error
    ema_short_period: Range(2, 20),
    ema_long_period: Range(20, 100),
    signal_period: Range(1, 20),
    up_trend_threshold: Range(0, 50),
    down_trend_threshold: Range(0, 50),
    overbought_rsi_periods: Range(1, 50),
    overbought_rsi: Range(20, 100)
  },
  trendline: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    lastpoints: Range(20, 500),
    avgpoints: Range(300, 3000),
    lastpoints2: Range(5, 300),
    avgpoints2: Range(50, 1000),
  },
  ta_ema: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 100),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    trend_ema: Range(2, TREND_EMA_MAX),
    oversold_rsi_periods: Range(RSI_PERIODS_MIN, RSI_PERIODS_MAX),
    oversold_rsi: Range(OVERSOLD_RSI_MIN, OVERSOLD_RSI_MAX),
    neutral_rate: RangeItems(['auto', 'auto_trend']),
    neutral_rate_min: RangeFloat(0, 1)
  },
  dema: {
    // -- common
    selector: RangeItems(selectors),
    period_length: RangePeriod(1, 120, 's'),
    min_periods: Range(1, 200),
    markdown_buy_pct: RangeFloat(0, 0),
    markup_sell_pct: RangeFloat(0, 0),
    order_type: RangeMakerTaker(),
    order_type_stop: RangeMakerTaker(),
    sell_stop_pct: Range0(1, 20),
    buy_stop_pct: Range0(1, 20),
    profit_stop_enable_pct: Range(0, 0),
    profit_stop_pct: Range(1, 20),

    // -- strategy
    ema_short_period: Range(1, 20),
    ema_long_period: Range(20, 100),
    signal_period: Range(1, 20),
    up_trend_threshold: Range(0, 50),
    down_trend_threshold: Range(0, 50),
    overbought_rsi_periods: Range(1, 50),
    overbought_rsi: Range(20, 100)
  }
};

let allStrategyNames = () => {
  let r = [];
  for (let k in strategies) {
    r.push(k);
  }
  return r;
};

let simArgs = {
  filename: 'none',
  silent: true,

  toString: function() {
    let list = [];
    for(let name in this) {
      if (this.hasOwnProperty(name) && typeof this[name] !== 'function') {
        if (this[name] === true) {
          list.push('--' + name);
        } else if (this[name] !== false) {
          list.push('--' + name + '="' + this[name] + '"');
        }
      }
    }
    return list.join(' ');
  }
};

if (argv.start) {
  simArgs.start = argv.start;
}
if (argv.days) {
  simArgs.days = argv.days;
}
if (argv.currency_capital) {
  simArgs.currency_capital = argv.currency_capital;
}
if (argv.asset_capital) {
  simArgs.asset_capital = argv.asset_capital;
}
if (argv.symmetrical) {
  simArgs.symmetrical = 'true';
}
console.log(simArgs)

let strategyName = (argv.use_strategies) ? argv.use_strategies : 'all';
let populationFileName = (argv.population_data) ? argv.population_data : null;
let populationSize = (argv.population) ? argv.population : 100;
let populationSurvive = (argv.population_survive) ? argv.population_survive : 0.5;
let threadCount = (argv.threads) ? argv.threads : PARALLEL_LIMIT;

console.log(`Backtesting strategy ${strategyName} ...`);
console.log(`Creating population of ${populationSize} ...\n`);

let pools = {};
let selectedStrategies = (strategyName === 'all') ? allStrategyNames() : strategyName.split(',');

let importedPoolData = (populationFileName) ? JSON.parse(fs.readFileSync(populationFileName, 'utf8')) : null;

selectedStrategies.forEach(function(v) {
  let strategyPool = pools[v] = {};

  let evolve = true;
  let population = (importedPoolData && importedPoolData[v]) ? importedPoolData[v] : [];
  for (let i = population.length; i < populationSize; ++i) {
    population.push(Phenotypes.create(strategies[v]));
    evolve = false;
  }

  strategyPool['config'] = {
    createFunction: function() {
      return Phenotypes.create(strategies[v]);
    },
    mutationFunction: function(phenotype) {
      return Phenotypes.mutation(phenotype, strategies[v]);
    },
    crossoverFunction: function(phenotypeA, phenotypeB) {
      return Phenotypes.crossover(phenotypeA, phenotypeB, strategies[v]);
    },
    fitnessFunction: Phenotypes.fitness,
    placeFunction: Phenotypes.place,
    competeFunction: Phenotypes.competition,
    population: population,
    populationSize: populationSize,
    populationSurvive: populationSurvive,
    avoidDuplicates: true
  };

  strategyPool['pool'] = GeneticAlgorithmCtor(strategyPool.config);
  if (evolve) {
    strategyPool['pool'].evolve();
  }
});

let isUsefulKey = key => {
  if(key == "filename" || key == "show_options" || key == "sim") return false;
  return true;
}
let generateCommandParams = input => {
  input = input.params.replace("module.exports =","");
  input = JSON.parse(input);

  let result = "";
  let keys = Object.keys(input);
  for(i = 0;i < keys.length;i++){
    let key = keys[i];
    if(isUsefulKey(key)){
      // selector should be at start before keys
      if(key == "selector"){
        result = input[key] + result;
      }
      
      else result += " --"+key+"="+input[key];
    }
    
  }
  return result;
}
let saveGenerationData = function(csvFileName, jsonFileName, dataCSV, dataJSON, callback){
  fs.writeFile(csvFileName, dataCSV, err => {
    if (err) throw err;
    console.log("> Finished writing generation csv to " + csvFileName);
    callback(1);
  });
  fs.writeFile(jsonFileName, dataJSON, err => {
    if (err) throw err;
    console.log("> Finished writing generation json to " + jsonFileName);
    callback(2);
  });
}
let generationCount = 0;

let simulateGeneration = () => {
  console.log(`\n\n=== Simulating generation ${++generationCount} ===\n`);

  let days
  if (!argv.days && argv.start) {
    let start = moment(argv.start).valueOf();
    let end
    if (argv.end) {
      end = moment(argv.end).valueOf();
    } else {
      end = tb('1d').toMilliseconds();
    }
    days = Math.floor((end - start) / 86400000) + 1;
  } else {
    days = argv.days
  }

  selectors.forEach(function(s) {
    runUpdate(days, s);
  })

  let daysList = [];
  do {
    daysList.push(days)
    if (days > 60) {
      days = days -30
    } else {
      days = Math.floor(days / 2)
    }
  } while(days >= 3)

  let simulateDays = () => {
    simArgs.days = daysList.pop();
    delete(simArgs.start)

    iterationCount = 1;

    console.log("\n\Start simulation for " + simArgs.days + " days...\n" );

    let tasks = selectedStrategies.map(v => pools[v]['pool'].population().map(phenotype => {
      return cb => {
        runCommand(v, phenotype, cb);
      };
    })).reduce((a, b) => a.concat(b));

    parallel(tasks, threadCount, (err) => {

      let poolData = {};
      selectedStrategies.forEach(function(v) {
        let population = pools[v]['pool'].population();
        population.sort((a, b) => (a.sim.fitness < b.sim.fitness) ? 1 : ((b.sim.fitness < a.sim.fitness) ? -1 : 0));
        let place = 0;
        population.forEach(function(phenotype) {
          phenotype.places.push(++place);
        });
        poolData[v] = population;
      });

      console.log("\n\Generation simulated for " + simArgs.days + " days..." );

      if (daysList.length > 0) {

        simulateDays();

      } else {
        let results = [];

        selectedStrategies.forEach(function(v) {
          poolData[v].forEach(function(phenotype) {
            phenotype.sim.uuid = phenotype.uuid;
            phenotype.sim.places = phenotype.places;
            phenotype.places = [];
            phenotype.sim['place'] = Phenotypes.place(phenotype);
            results.push(phenotype.sim);
          });
          poolData[v].sort((a, b) => (a.sim.place > b.sim.place) ? 1 : ((b.sim.place > a.sim.place) ? -1 : (a.sim.fitness < b.sim.fitness) ? 1 : ((b.sim.fitness < a.sim.fitness) ? -1 : 0)));
        });

        results.sort((a, b) => (a.place > b.place) ? 1 : ((b.place > a.place) ? -1 : (a.fitness < b.fitness) ? 1 : ((b.fitness < a.fitness) ? -1 : 0)));

        console.log("\n\Generation complete, saving results...");

        let fieldsGeneral = ['selector', 'uuid', 'places', 'place', 'fitness', 'vsBuyHold', 'wlRatio', 'frequency', 'strategy', 'order_type', 'endBalance', 'buyHold', 'fees', 'wins', 'losses', 'period_length', 'days', 'params'];
        let fieldNamesGeneral = ['Selector', 'UUID', 'Places', 'Place', 'Fitness', 'VS Buy Hold (%)', 'Win/Loss Ratio', '# Trades/Day', 'Strategy', 'Order Type', 'Ending Balance ($)', 'Buy Hold ($)', 'Fees ($)', '# Wins', '# Losses', 'Period', '# Days', 'Full Parameters'];

        let dataCSV = json2csv({
          data: results,
          fields: fieldsGeneral,
          fieldNames: fieldNamesGeneral
        });

        let dataJSON = JSON.stringify(poolData, null, 2);

        let fileIdentifier = Math.round(+new Date() / 1000);
        if (selectors.length === 1) {
          fileIdentifier = selectors[0] + '_' + fileIdentifier;
        }
        fileIdentifier = fileIdentifier + '_gen_' + generationCount

        let csvFileName = `simulations/backtesting_${fileIdentifier}.csv`;
        let jsonFileName = `simulations/generation_data_${fileIdentifier}.json`;
        let filesSaved = 0;
        saveGenerationData(csvFileName, jsonFileName, dataCSV, dataJSON, (id)=>{
          filesSaved++;
          if(filesSaved == 2){
            console.log(`\n\nGeneration's Best Results`);
            selectedStrategies.forEach((v)=> {
              let best = poolData[v][0];
              console.log(`\t(${v}) Sim Fitness ${best.sim.fitness}, VS Buy and Hold: ${best.sim.vsBuyHold} End Balance: ${best.sim.endBalance}, Wins/Losses ${best.sim.wins}/${best.sim.losses}.`);
              let bestCommand = generateCommandParams(best.sim);

              // prepare command snippet from top result for this strat
              console.log('./zenbot.sh sim ' + bestCommand + '\n');

              pools[v]['pool'].evolve();
            });

            simulateGeneration();
          }
        });

      }

    });

  };

  simulateDays();

};

simulateGeneration();
