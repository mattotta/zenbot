let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'trend_ema_new',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0). Optional buy on low RSI.',

    getOptions: function () {
      this.option('period', 'period length', String, '2m')
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
      this.option('neutral_rate_min', 'avoid trades if neutral_rate under this float(s)')
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
      if (s.options.overbought_rsi) {
        // sync RSI display with overbought RSI periods
        s.options.rsi_periods = s.options.overbought_rsi_periods
        get('lib.rsi')(s, 'overbought_rsi', s.options.overbought_rsi_periods)
        if (!s.in_preroll && s.period.overbought_rsi <= s.options.overbought_rsi && !s.oversold && !s.cancel_down) {
          s.oversold = true
          if (s.options.mode !== 'sim' || s.options.verbose) console.log(('\noversold at ' + s.period.oversold_rsi + ' RSI, preparing to buy\n').cyan)
        }
      }      if (s.period.trend_ema && s.lookback[0] && s.lookback[0].trend_ema) {
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
          s.signal = 'buy'
          s.cancel_down = true
          return cb()
        }
      }

      let signal = this.getSignal(s)
      if (signal === 'buy') {
        s.signal = signal
        s.cancel_down = false
      }
      else if (!s.cancel_down && signal === 'sell') {
        s.signal = signal
      } else {
        s.signal = null
      }

      cb()
    },

    onReport: function (s) {
      let cols = []

      if (typeof s.period.trend_ema_rate === 'number' && typeof s.period.trend_ema_stddev === 'number') {
        let signal = this.getSignal(s)
        let color = 'grey'
        if (signal === 'buy') {
          color = 'green'
        }
        else if (signal === 'sell') {
          color = 'red'
        }
        cols.push(z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color])
        cols.push(z(8, n(s.period.trend_ema_stddev).format('0.0000'), ' ').grey)
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
    },

    getSignal: function (s) {
      let signal = null

      if (s.lookback[0]) {
        let trend1 = this.getTrend(s, s.lookback[0])
        let trend2 = this.getTrend(s, s.period)

        if (s.options.reversed) {
          
        }
          if (trend1 === 'up' && trend2 === null) {
            signal = 'sell'
          } else if (trend1 === 'down' && trend2 === null) {
            signal = 'buy'
          }
        } else {
          if (trend1 !== 'up' && trend2 === 'up') {

      }


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
    },

    getTrend: function(s, period) {
      let trend = null

      if (typeof period.trend_ema_stddev === 'number') {

        if (typeof s.options.neutral_rate_min === 'object') {
          let neutral_rates = s.options.neutral_rate_min.sort()
          let ema_weak = Math.max(period.trend_ema_stddev, neutral_rates[0])
          let ema_strong = Math.max(period.trend_ema_stddev, neutral_rates[neutral_rates.length - 1])

          if (period.trend_ema_rate > ema_weak) {
            if (period.trend_ema_rate > ema_strong) {
              trend = 'up_strong'
            } else {
              trend = 'up_weak'
            }
          }
          else if (period.trend_ema_rate < (ema_weak * -1)) {
            if (period.trend_ema_rate < (ema_strong * -1)) {
              trend = 'down_strong'
            } else {
              trend = 'down_weak'
            }
          }

        } else {

          let ema = period.trend_ema_stddev
          if (typeof s.options.neutral_rate_min === 'number') {
            ema = Math.max(period.trend_ema_stddev, s.options.neutral_rate_min)
          }
          if (period.trend_ema_rate > ema) {
            trend = 'up'
          }
          else if (!s.cancel_down && period.trend_ema_rate < (ema * -1)) {
            trend = 'down'
          }
        }
      }

      return trend
    },

  }
}
