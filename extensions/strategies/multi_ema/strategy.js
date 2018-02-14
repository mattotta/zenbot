let z = require('zero-fill')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'multi_ema',
    description: 'Buy when (EMA - last(EMA) > 0) and sell when (EMA - last(EMA) < 0).',

    getOptions: function (s) {
      this.option('period', 'period length, same as --period_length', String, '2m')
      this.option('period_length', 'period length, same as --period', String, '2m')
      this.option('ema_type_weak_down', 'type of calculation method for weak down trend EMA', String, 'ema')
      this.option('ema_type_weak_up', 'type of calculation method for weak up trend EMA', String, 'ema')
      this.option('ema_type_strong_down', 'type of calculation method for strong down trend EMA', String, 'ema')
      this.option('ema_type_strong_up', 'type of calculation method for strong up trend EMA', String, 'ema')
      this.option('ema_periods_weak_down', 'number of periods for weak down trend EMA', Number, 26)
      this.option('ema_periods_weak_up', 'number of periods for weak up trend EMA', Number, 26)
      this.option('ema_periods_strong_down', 'number of periods for strong down trend EMA', Number, 26)
      this.option('ema_periods_strong_up', 'number of periods for strong up trend EMA', Number, 26)
      this.option('neutral_rate_weak_down', 'avoid trades if abs(trend_ema_weak_down) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_weak_up', 'avoid trades if abs(trend_ema_weak_up) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_strong_down', 'avoid trades if abs(trend_ema_strong_down) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_strong_up', 'avoid trades if abs(trend_ema_strong_up) under this float (0 to disable, "auto" for a variable filter)', String, 'auto')
      this.option('neutral_rate_min_weak_down', 'avoid trades if neutral_rate_weak_down under this float', Number, 0)
      this.option('neutral_rate_min_weak_up', 'avoid trades if neutral_rate_weak_up under this float', Number, 0)
      this.option('neutral_rate_min_strong_down', 'avoid trades if neutral_rate_strong_down under this float', Number, 0)
      this.option('neutral_rate_min_strong_up', 'avoid trades if neutral_rate_strong_up under this float', Number, 0)
      this.option('order_type_weak', 'order type for orders based on weak signal', String)
      this.option('order_type_strong', 'order type for orders based on strong signal', String)
      this.option('decision', 'control decision mode', String, 'direct')
      this.option('rsi_periods', 'number of periods for RSI')
      this.option('rsi_periods_oversold', 'number of periods for RSI (oversold)')
      this.option('rsi_periods_overbought', 'number of periods for RSI (overbought)')
      this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)
      this.option('overbought_rsi', 'sell when RSI reaches this value', Number, 90)
      this.option('order_type_rsi', 'order type for orders based on rsi signal', String)

      // avoid TA_BAD_PARAM errors cause by ema_perdios == 1
      if (s.options.ema_type_weak_down === 'ta_ema') {
        s.options.ema_periods_weak_down = Math.max(s.options.ema_periods_weak_down, 2)
      }
      if (s.options.ema_type_weak_up === 'ta_ema') {
        s.options.ema_periods_weak_up = Math.max(s.options.ema_periods_weak_up, 2)
      }
      if (s.options.ema_type_strong_down === 'ta_ema') {
        s.options.ema_periods_strong_down = Math.max(s.options.ema_periods_strong_down, 2)
      }
      if (s.options.ema_type_strong_up === 'ta_ema') {
        s.options.ema_periods_strong_up = Math.max(s.options.ema_periods_strong_up, 2)
      }

      if (typeof s.options.rsi_periods_oversold === 'undefined' || s.options.rsi_periods_oversold === 'undefined') {
        if (typeof s.options.rsi_periods === 'undefined' || s.options.rsi_periods === 'undefined') {
          s.options.rsi_periods_oversold = 14
        } else {
          s.options.rsi_periods_oversold = s.options.rsi_periods;
        }
      }
      if (typeof s.options.rsi_periods_overbought === 'undefined' || s.options.rsi_periods_overbought === 'undefined') {
        if (typeof s.options.rsi_periods === 'undefined' || s.options.rsi_periods === 'undefined') {
          s.options.rsi_periods_overbought = 14
        } else {
          s.options.rsi_periods_overbought = s.options.rsi_periods;
        }
      }
      s.options.rsi_periods = 'undefined'

      // set min_periods to maximum needed value to start trading immediately
      s.options.min_periods = Math.max(
        s.options.min_periods,
        s.options.rsi_periods_oversold,
        s.options.rsi_periods_overbought,
        s.options.ema_periods_weak_down,
        s.options.ema_periods_weak_up,
        s.options.ema_periods_strong_down,
        s.options.ema_periods_strong_up
      )

      // get order type
      if (!s.options.order_type_weak) {
        s.options.order_type_weak = s.options.order_type
      }
      if (!s.options.order_type_strong) {
        s.options.order_type_strong = s.options.order_type
      }
      if (!s.options.order_type_rsi) {
        s.options.order_type_rsi = s.options.order_type
      }
    },

    calculate: function (s) {
      if (s.options.mode !== 'sim' && s.options.mode !== 'train') {
        // s.strategy.calculateTrend(s)
      }
    },

    calculateTrend: function(s) {
      if (s.options.rsi_periods_overbought) {
        get('lib.rsi')(s, 'rsi_overbought', s.options.rsi_periods_overbought)
        if (!s.in_preroll && s.period.rsi_overbought >= s.options.overbought_rsi && !s.overbought) {
          s.overbought = true
          if (s.options.mode !== 'sim' || s.options.verbose) console.log(('\noverbought at ' + s.period.rsi_overbought + ' RSI, preparing to sell\n').cyan)
        }
      }

      if (s.options.rsi_periods_oversold) {
        get('lib.rsi')(s, 'rsi_oversold', s.options.rsi_periods_oversold)
        if (!s.in_preroll && s.period.rsi_oversold <= s.options.oversold_rsi && !s.oversold) {
          s.oversold = true
          if (s.options.mode !== 'sim' || s.options.verbose) console.log(('\noversold at ' + s.period.rsi + ' RSI, preparing to buy\n').cyan)
        }
      }

      s.strategy.calculateEma(s, 'weak_down')
      s.strategy.calculateEma(s, 'weak_up')
      s.strategy.calculateEma(s, 'strong_down')
      s.strategy.calculateEma(s, 'strong_up')

      s.period.trend = null

      if ((typeof s.period.trend_ema_stddev_weak_down === 'number') &&
        (typeof s.period.trend_ema_stddev_weak_up === 'number') &&
        (typeof s.period.trend_ema_stddev_strong_down === 'number') &&
        (typeof s.period.trend_ema_stddev_strong_up === 'number')) {

        let ema_weak_down = Math.max(s.period.trend_ema_stddev_weak_down, s.options.neutral_rate_min_weak_down)
        let ema_weak_up = Math.max(s.period.trend_ema_stddev_weak_up, s.options.neutral_rate_min_weak_up)
        let ema_strong_down = Math.max(s.period.trend_ema_stddev_strong_down, s.options.neutral_rate_min_strong_down)
        let ema_strong_up = Math.max(s.period.trend_ema_stddev_strong_up, s.options.neutral_rate_min_strong_up)

        if (s.period.trend_ema_rate_strong_down <= (ema_strong_down * -1)) {
          s.period.trend = 'down_strong'
        }
        else if (s.period.trend_ema_rate_strong_up >= ema_strong_up) {
          s.period.trend = 'up_strong'
        }
        else if (s.period.trend_ema_rate_weak_down <= (ema_weak_down * -1)) {
          s.period.trend = 'down_weak'
        }
        else if (s.period.trend_ema_rate_weak_up >= ema_weak_up) {
          s.period.trend = 'up_weak'
        }
      }
    },

    calculateEma: function (s, type) {
      let trend_name = 'trend_ema_' + type,
        rate_name = 'trend_ema_rate_' + type,
        stddev_name = 'trend_ema_stddev_' + type,
        periods_name = 'ema_periods_' + type,
        neutral_name = 'neutral_rate_' + type

      get('lib.' + s.options['ema_type_' + type])(s, trend_name, s.options[periods_name])

      if (s.period[trend_name] && s.lookback[0] && s.lookback[0][trend_name]) {
        s.period[rate_name] = (s.period[trend_name] - s.lookback[0][trend_name]) / s.lookback[0][trend_name] * 100
      }
      if (s.options[neutral_name] === 'auto') {
        get('lib.stddev')(s, stddev_name, 10, rate_name)
      }
      else if (s.options[neutral_name] === 'auto_trend') {
        get('lib.stddev')(s, stddev_name, s.options[periods_name], rate_name)
      }
      else if (s.options[neutral_name] === 'auto_new') {
        let trend_ema
        if (s.lookback[0] && s.lookback[0][trend_name]) {
          trend_ema = s.lookback[0][trend_name]
        } else {
          trend_ema = s.period[trend_name]
          s.period[stddev_name] = s.period[trend_name] / s.options[periods_name]
        }
        while (trend_ema > 1) {
          trend_ema = trend_ema / 10
        }
        s.period[stddev_name] = trend_ema / s.options[periods_name]
      }
      else {
        s.period[stddev_name] = s.options[neutral_name]
      }
    },

    onPeriod: function (s, cb) {
      s.strategy.calculateTrend(s)

      if (!s.in_preroll && typeof s.period.rsi_overbought === 'number') {
        if (s.overbought) {
          s.overbought = false
          s.oversold = false
          s.trend = 'overbought'
          s.signal = 'sell'
          s.options.order_type = s.options.order_type_rsi
          return cb()
        }
      }

      if (!s.in_preroll && typeof s.period.rsi_oversold === 'number') {
        if (s.oversold) {
          s.overbought = false
          s.oversold = false
          s.trend = 'oversold'
          s.signal = 'buy'
          s.options.order_type = s.options.order_type_rsi
          return cb()
        }
      }

      let signal = s.strategy.getSignal(s, true)

      if (signal === 'buy' && s.my_trades.length && s.my_trades[s.my_trades.length - 1].type === signal) {
        // avoid multiple buy signals
        signal = null
      }
        
      s.signal = signal
      cb()
    },
    
    reportRsi: function (rsi) {
      console.log(rsi)
      if (typeof rsi === 'number') {
        let half = 5
        let bar = ''
        let stars = 0
        let rsi_format = n(rsi).format('00.00')
        if (rsi >= 50) {
          stars = Math.min(Math.round(((rsi - 50) / 50) * half) + 1, half)
          bar += ' '.repeat(half - (rsi < 100 ? 3 : 4))
          bar += rsi_format.green + ' '
          bar += '+'.repeat(stars).green.bgGreen
          bar += ' '.repeat(half - stars)
        }
        else {
          stars = Math.min(Math.round(((50 - rsi) / 50) * half) + 1, half)
          bar += ' '.repeat(half - stars)
          bar += '-'.repeat(stars).red.bgRed
          bar += rsi_format.length > 1 ? ' ' : '  '
          bar += rsi_format.red
          bar += ' '.repeat(half - 3)
        }
        return ' ' + bar
      }
      else {
        return ' '.repeat(14)
      }
    },

    onReport: function (s) {
      let cols = []
      
      cols.push(s.strategy.reportRsi(s.period.rsi_oversold))
      cols.push(s.strategy.reportRsi(s.period.rsi_overbought))

      let sign = '  |  '
      let color_weak_down = 'grey'
      let color_weak_up = 'grey'
      let color_strong_down = 'grey'
      let color_strong_up = 'grey'
      let color_sign= 'grey'
      if (s.period.trend === 'down_strong') {
        sign = '<<|  '
        color_sign = 'red'
        color_strong_down = 'red'
      } else if (s.period.trend === 'down_weak') {
        sign = ' <|  '
        color_sign = 'red'
        color_weak_down = 'red'
      } else if (s.period.trend === 'up_weak') {
        sign = '  |> '
        color_sign = 'green'
        color_weak_up = 'green'
      } else if (s.period.trend === 'up_strong') {
        sign = '  |>>'
        color_sign = 'green'
        color_strong_up = 'green'
      }
      if (typeof s.period.trend_ema_rate_strong_down === 'number' && typeof s.period.trend_ema_stddev_strong_down === 'number') {
        let ema_strong_down = Math.max(s.period.trend_ema_stddev_strong_down, s.options.neutral_rate_min_strong_down)
        cols.push(z(8, n(s.period.trend_ema_rate_strong_down).format('0.0000'), ' ')[color_strong_down])
        cols.push(z(8, n(ema_strong_down).multiply(-1).format('0.0000'), ' ').grey)
      } else {
        cols.push('                  ')
      }
      if (typeof s.period.trend_ema_rate_weak_down === 'number' && typeof s.period.trend_ema_stddev_weak_down === 'number') {
        let ema_weak_down = Math.max(s.period.trend_ema_stddev_weak_down, s.options.neutral_rate_min_weak_down)
        cols.push(z(8, n(s.period.trend_ema_rate_weak_down).format('0.0000'), ' ')[color_weak_down])
        cols.push(z(8, n(ema_weak_down).multiply(-1).format('0.0000'), ' ').grey)
      } else  {
        cols.push('                  ')
      }
      if (typeof s.period.trend_ema_rate_weak_up === 'number' && typeof s.period.trend_ema_stddev_weak_up === 'number') {
        let ema_weak_up = Math.max(s.period.trend_ema_stddev_weak_up, s.options.neutral_rate_min_weak_up)
        cols.push(z(8, n(s.period.trend_ema_rate_weak_up).format('0.0000'), ' ')[color_weak_up])
        cols.push(z(8, n(ema_weak_up).format('0.0000'), ' ').grey)
      } else  {
        cols.push('                  ')
      }
      if (typeof s.period.trend_ema_rate_strong_up === 'number' && typeof s.period.trend_ema_stddev_strong_up === 'number') {
        let ema_strong_up = Math.max(s.period.trend_ema_stddev_strong_up, s.options.neutral_rate_min_strong_up)
        cols.push(z(8, n(s.period.trend_ema_rate_strong_up).format('0.0000'), ' ')[color_strong_up])
        cols.push(z(8, n(ema_strong_up).format('0.0000'), ' ').grey)
      } else {
        cols.push('                  ')
      }
      cols.push(z(7, sign, ' ')[color_sign])

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
