let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'trend_ema_new',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0). Optional buy on low RSI.',

    getOptions: function (s) {
      this.option('period', 'period length, same as --period_length', String, '2m')
      this.option('period_length', 'period length, same as --period', String, '2m')
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_min_1', 'avoid trades if neutral_rate under this float', Number, 0)
      this.option('neutral_rate_min_2', 'avoid trades if neutral_rate under this float', Number, 0)
      this.option('decision', 'control decision mode', String, 'direct')
      this.option('order_type_weak', 'order type for orders based on weak signal', String)
      this.option('order_type_strong', 'order type for orders based on strong signal', String)

      // process neutral rate parameter
      if (s.options.neutral_rate_min_1 > s.options.neutral_rate_min_2) {
        s.options.neutral_rate_min_weak = s.options.neutral_rate_min_2
        s.options.neutral_rate_min_strong = s.options.neutral_rate_min_1
      } else {
        s.options.neutral_rate_min_weak = s.options.neutral_rate_min_1
        s.options.neutral_rate_min_strong = s.options.neutral_rate_min_2
      }

      // get order type
      if (!s.options.order_type_weak) {
        s.options.order_type_weak = s.options.order_type
      }
      if (!s.options.order_type_strong) {
        s.options.order_type_strong = s.options.order_type
      }
    },

    calculate: function (s) {
      get('lib.ema')(s, 'trend_ema', s.options.trend_ema)
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

        let ema_weak = Math.max(s.period.trend_ema_stddev, s.options.neutral_rate_min_weak)
        let ema_strong = Math.max(s.period.trend_ema_stddev, s.options.neutral_rate_min_strong)

        if (s.period.trend_ema_rate >= ema_weak) {
          if (s.period.trend_ema_rate >= ema_strong) {
            s.period.trend = 'up_strong'
          } else {
            s.period.trend = 'up_weak'
          }
        }
        else if (s.period.trend_ema_rate <= (ema_weak * -1)) {
          if (s.period.trend_ema_rate <= (ema_strong * -1)) {
            s.period.trend = 'down_strong'
          } else {
            s.period.trend = 'down_weak'
          }
        }
      }
    },

    onPeriod: function (s, cb) {
      let signal = s.strategy.getSignal(s, true)
      if (signal && s.my_trades.length) {
        if (s.my_trades[s.my_trades.length - 1].type === signal) {
          // avoid same action like last trade
          signal = null
        }
      }
        
      s.signal = signal
      cb()
    },

    onReport: function (s) {
      let cols = []

      if (typeof s.period.trend_ema_rate === 'number' && typeof s.period.trend_ema_stddev === 'number') {
        let signal = s.strategy.getSignal(s, false)
        let color = 'grey'
        if (signal === 'buy') {
          color = 'green'
        } else if (signal === 'sell') {
          color = 'red'
        }
        cols.push(z(8, n(s.period.trend_ema_rate).format('0.0000'), ' ')[color])
        cols.push(z(8, n(s.period.trend_ema_stddev).format('0.0000'), ' ').grey)
        let sign = '  |  '
        color = 'grey'
        if (s.period.trend === 'down_strong') {
          sign = '<<|  '
          color = 'red'
        } else if (s.period.trend === 'down_weak') {
          sign = ' <|  '
          color = 'red'
        } else if (s.period.trend === 'up_weak') {
          sign = '  |> '
          color = 'green'
        } else if (s.period.trend === 'up_strong') {
          sign = '  |>>'
          color = 'green'
        }
        cols.push(z(7, sign, ' ')[color])
      } else {
        if (!s.period.trend_ema_stddev) {
          cols.push('                         ')
        } else {
          cols.push('                ')
        }
      }

      return cols
    },

    getSignal: function (s, remember) {
      let signal = null
      let type = null

      if (s.lookback[0]) {
        let trend1 = s.lookback[0].trend
        let trend2 = s.period.trend

        if (s.options.decision === 'direct') {
          if (trend2 === 'up_strong' || trend2 === 'down_weak') {
            signal = 'sell'
          } else if (trend2 === 'down_strong' || trend2 === 'up_weak') {
            signal = 'buy'
          }
          if (trend2 === 'up_strong' || trend2 === 'down_strong') {
            type = 'strong'
          } else if (trend2 === 'down_weak' || trend2 === 'down_weak') {
            type = 'weak'
          }

        } else if (s.options.decision === 'direct-remember') {
          if (trend2 === 'up_strong') {
            if (remember) {
              s.sold_after_drop = true
              s.bought_after_rise = false
            }
            signal = 'sell'
            type = 'strong'
          } else if (trend2 === 'down_strong') {
            if (remember) {
              s.bought_after_rise = true
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'strong'
          } else if (trend2 === 'up_weak' && !s.sold_after_drop) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'weak'
          } else if (trend2 === 'down_weak' && !s.bought_after_rise) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'sell'
            type = 'weak'
          } else if (trend2 === null) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
          }

        } else if (s.options.decision === 'after') {
          if (trend1 === 'up_strong' && trend2 !== 'up_strong') {
            signal = 'sell'
            type = 'strong'
          } else if (trend1 === 'down_strong' && trend2 !== 'down_strong') {
            signal = 'buy'
            type = 'strong'
          } else if (trend2 === 'up_weak' || trend2 === 'up_strong') {
            signal = 'buy'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          } else if (trend2 === 'down_weak' || trend2 === 'down_strong') {
            signal = 'sell'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          }

        } else if (s.options.decision === 'after-remember') {
          if (trend1 === 'up_strong' && trend2 !== 'up_strong') {
            if (remember) {
              s.sold_after_drop = true
              s.bought_after_rise = false
            }
            signal = 'sell'
            type = 'strong'
          } else if (trend1 === 'down_strong' && trend2 !== 'down_strong') {
            if (remember) {
              s.bought_after_rise = true
              s.sold_after_drop = false
            }
            signal = 'buy'
            type = 'strong'
          } else if ((trend2 === 'up_weak' && !s.sold_after_drop) || trend2 === 'up_strong') {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'buy'
            if (trend2 === 'up_strong') {
              type = 'strong'
            } else if (trend2 === 'up_weak') {
              type = 'weak'
            }
          } else if ((trend2 === 'down_weak' && !s.bought_after_rise) || trend2 === 'down_strong') {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
            signal = 'sell'
            if (trend2 === 'down_strong') {
              type = 'strong'
            } else if (trend2 === 'down_weak') {
              type = 'weak'
            }
          } else if (trend2 === null) {
            if (remember) {
              s.bought_after_rise = false
              s.sold_after_drop = false
            }
          }
        }

        if (signal !== null) {
          if (type === 'weak') {
            s.options.order_type = s.options.order_type_weak
          } else if (type === 'strong') {
            s.options.order_type = s.options.order_type_strong
          }
        }
      }

      return signal
    }
  }
}
