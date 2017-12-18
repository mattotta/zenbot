let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'trend_ema_new',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0). Optional buy on low RSI.',

    getOptions: function (s) {
      this.option('period', 'period length', String, '2m')
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
      this.option('neutral_rate_min', 'avoid trades if neutral_rate under this float(s)', String)

      // process neutral rate parameter
      s.options.neutral_rate_min = s.options.neutral_rate_min.split(';').sort()
    },

    calculate: function (s) {
      get('lib.ema')(s, 'trend_ema', s.options.trend_ema, s.options.ema_source)
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

      s.period.trend = null

      if (typeof s.period.trend_ema_stddev === 'number') {

        let ema_weak = Math.max(s.period.trend_ema_stddev, s.options.neutral_rate_min[0])
        let ema_strong = Math.max(s.period.trend_ema_stddev, s.options.neutral_rate_min[s.options.neutral_rate_min.length - 1])

        if (s.period.trend_ema_rate > ema_weak) {
          if (s.period.trend_ema_rate > ema_strong) {
            s.period.trend = 'up_strong'
          } else {
            s.period.trend = 'up_weak'
          }
        }
        else if (s.period.trend_ema_rate < (ema_weak * -1)) {
          if (s.period.trend_ema_rate < (ema_strong * -1)) {
            s.period.trend = 'down_strong'
          } else {
            s.period.trend = 'down_weak'
          }
        }
      }
    },

    onPeriod: function (s, cb) {
      s.signal = s.strategy.getSignal(s)
      cb()
    },

    onReport: function (s) {
      let cols = []

      if (typeof s.period.trend_ema_rate === 'number' && typeof s.period.trend_ema_stddev === 'number') {
        let signal = s.strategy.getSignal(s)
        let color = 'grey'
        if (signal === 'buy') {
          color = 'green'
        } else if (signal === 'sell') {
          color = 'red'
        }
        cols.push(z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color])
        cols.push(z(8, n(s.period.trend_ema_stddev).format('0.0000'), ' ').grey)
      } else {
        if (s.period.trend_ema_stddev) {
          cols.push('                  ')
        } else {
          cols.push('         ')
        }
      }

      return cols
    },

    getSignal: function (s) {
      let signal = null

      if (s.lookback[0]) {
        let trend1 = s.lookback[0].trend
        let trend2 = s.period.trend

        if (trend2 === 'up_weak' || trend2 === 'up_strong') {
          signal = 'buy'
        } else if (trend2 === 'down_weak' || trend2 === 'down_strong') {
          signal = 'sell'
        } else if (trend1 === 'up_strong' && trend2 !== 'up_strong' && trend2 !== 'up_weak') {
          signal = 'sell'
        } else if (trend1 === 'down_strong' && trend2 !== 'down_strong' && trend2 !== 'down_weak') {
          signal = 'buy'
        }
      }

      return signal
    }
  }
}
