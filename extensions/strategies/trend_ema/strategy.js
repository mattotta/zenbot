let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'trend_ema',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0). Optional buy on low RSI.',

    getOptions: function () {
      this.option('period', 'period length, same as --period_length', String, '2m')
      this.option('period_length', 'period length, same as --period', String, '2m')
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
      this.option('neutral_rate_min', 'avoid trades if neutral_rate under this float', Number, 0)
      this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
      this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)
      this.option('ema_source', 'buy when RSI reaches this value', String, 'close')
      this.option('reversed', 'act reversed on trend', Number, 0)
    },

    calculate: function (s) {
      get('lib.ema')(s, 'trend_ema', s.options.trend_ema, s.options.ema_source)
      if (s.options.oversold_rsi) {
        // sync RSI display with oversold RSI periods
        s.options.rsi_periods = s.options.oversold_rsi_periods
        get('lib.rsi')(s, 'oversold_rsi', s.options.oversold_rsi_periods)
        if (!s.in_preroll && s.period.oversold_rsi <= s.options.oversold_rsi && !s.oversold && !s.cancel_down) {
          s.oversold = true
          if (s.options.mode !== 'sim' || s.options.verbose) console.log(('\noversold at ' + s.period.oversold_rsi + ' RSI, preparing to buy\n').cyan)
        }
      }
      if (s.period.trend_ema && s.lookback[0] && s.lookback[0].trend_ema) {
        s.period.trend_ema_rate = (s.period.trend_ema - s.lookback[0].trend_ema) / s.lookback[0].trend_ema * 100
      }
      if (s.options.neutral_rate === 'auto') {
        get('lib.stddev')(s, 'trend_ema_stddev', 10, 'trend_ema_rate')
      }
      else if (s.options.neutral_rate === 'auto_trend') {
        get('lib.stddev')(s, 'trend_ema_stddev', s.options.trend_ema, 'trend_ema_rate')
      }
      else if (s.options.neutral_rate === 'auto_new') {
        var trend_ema
        if (s.lookback[0] && s.lookback[0].trend_ema) {
          trend_ema = s.lookback[0].trend_ema
        } else {
          trend_ema = s.period.trend_ema
          s.period.trend_ema_stddev = s.period.trend_ema / s.options.trend_ema
        }
        while (trend_ema > 1) {
          trend_ema = trend_ema / 10
        }
        s.period.trend_ema_stddev = trend_ema / s.options.trend_ema
      }
      else {
        s.period.trend_ema_stddev = s.options.neutral_rate
      }
    },

    onPeriod: function (s, cb) {
      if (!s.in_preroll && typeof s.period.oversold_rsi === 'number') {
        if (s.oversold) {
          s.oversold = false
          s.trend = 'oversold'
          s.signal = 'buy'
          s.cancel_down = true
          return cb()
        }
      }
      if (typeof s.period.trend_ema_stddev === 'number') {
        let ema = s.period.trend_ema_stddev
        if (s.options.neutral_rate_min) {
          ema = Math.max(ema, s.options.neutral_rate_min)
        }
        if (s.period.trend_ema_rate > ema) {
          if (s.trend !== 'up') {
            s.acted_on_trend = false
          }
          s.trend = 'up'
          s.signal = !s.acted_on_trend ? (s.options.reversed ? 'sell' : 'buy') : null
          s.cancel_down = false
        }
        else if (!s.cancel_down && s.period.trend_ema_rate < (ema * -1)) {
          if (s.trend !== 'down') {
            s.acted_on_trend = false
          }
          s.trend = 'down'
          s.signal = !s.acted_on_trend ? (s.options.reversed ? 'buy' : 'sell') : null
        }
      }
      cb()
    },

    onReport: function (s) {
      let cols = []
      if (typeof s.period.trend_ema_stddev === 'number') {
        let ema = s.period.trend_ema_stddev
        if (s.options.neutral_rate_min) {
          ema = Math.max(ema, s.options.neutral_rate_min)
        }
        let color = 'grey'
        if (s.period.trend_ema_rate > ema) {
          color = 'green'
        }
        else if (s.period.trend_ema_rate < (ema * -1)) {
          color = 'red'
        }
        cols.push(z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color])
        if (s.period.trend_ema_stddev) {
          cols.push(z(8, n(s.period.trend_ema_stddev).format('0.0000'), ' ').grey)
        }
      }
      else {
        if (s.period.trend_ema_stddev) {
          cols.push('                  ')
        }
        else {
          cols.push('         ')
        }
      }
      return cols
    }
  }
}
