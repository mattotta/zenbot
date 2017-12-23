let z = require('zero-fill'),
  n = require('numbro')

module.exports = function container (get, set, clear) {
  return {
    name: 'crossover_vwap',
    description: 'Estimate trends by comparing "Volume Weighted Average Price" to the "Exponential Moving Average".',

    getOptions: function () {
      // default start is 30, 108, 60.
      // these are relative to period length.

      /*
        Positive simulations during testing:

        zenbot sim kraken.XXRP-ZEUR --period="120m" --strategy=crossover_vwap --currency_capital=700 --asset_capital=0 --max_slippage_pct=100 --days=60 --avg_slippage_pct=0.045 --vwap_max=8000 --markup_sell_pct=0.5 --markdown_buy_pct=0.5 --emalen1=50
        zenbot sim kraken.XXRP-ZEUR --period="120m" --strategy=crossover_vwap --currency_capital=700 --asset_capital=0 --max_slippage_pct=100 --days=60 --avg_slippage_pct=0.045 --vwap_max=8000 --markup_sell_pct=0.5 --markdown_buy_pct=0.5 --emalen1=30
      */
      this.option('period', 'period length, same as --period_length', String, '120m')
      this.option('period_length', 'period length, same as --period', String, '120m')
      this.option('emalen1', 'Length of EMA 1', Number, 30 )//green
      this.option('smalen1', 'Length of SMA 1', Number, 108 )//red
      this.option('smalen2', 'Length of SMA 2', Number, 60 )//purple
      this.option('vwap_length', 'Min periods for vwap to start', Number, 10 )//gold
      this.option('vwap_max', 'Max history for vwap. Increasing this makes it more sensitive to short-term changes', Number, 8000)//gold
      this.option('min_diff_pct', 'Minimal difference to trigger a signal', Number, 0)
    },


    calculate: function (s) {
      get('lib.vwap')(s, 'vwap', s.options.vwap_length, s.options.vwap_max)//gold

      get('lib.ema')(s, 'ema1', s.options.emalen1)//green
      // get('lib.sma')(s, 'sma1', s.options.smalen1, 'high')//red
      // get('lib.sma')(s, 'sma2', s.options.smalen2)//purple
    },

    onPeriod: function (s, cb) {
      let emagreen = s.period.ema1,
        vwapgold = s.period.vwap

      // helper functions
      let trendUp = function (s, cancel) {
          if (s.trend !== 'up') {
            s.acted_on_trend = false
          }
          s.trend = 'up'
          s.signal = !s.acted_on_trend ? 'buy' : null
          s.cancel_down = false

          if(cancel) s.cancel_down = true
        },
        trendDown = function (s) {
          if (s.trend !== 'down') {
            s.acted_on_trend = false
          }
          s.trend = 'down'
          s.signal = !s.acted_on_trend ? 'sell' : null
        },
        noTrend = function (s) {
          s.trend = null
          s.signal = null
        }

      if (emagreen && vwapgold) {
        let diff_pct = Math.abs(emagreen - vwapgold) * 100 / emagreen
        if (diff_pct >= s.options.min_diff_pct) {
          if (vwapgold > emagreen) trendUp(s, true)
          else trendDown(s)
        } else {
          noTrend(s)
        }
      } else {
        noTrend(s)
      }
      cb()
    },

    onReport: function (s) {
      let cols = [],
        emagreen = s.period.ema1,
        vwapgold = s.period.vwap

      if (vwapgold && emagreen) {
        let color = 'grey'
        if (Math.abs(emagreen - vwapgold) > s.options.min_diff) {
          if (vwapgold > emagreen) color = 'red'
          else color = 'green'
        }

        cols.push(z(6, n(vwapgold).format('0.00000'), '')['yellow'] + ' ')
        cols.push(z(6, n(emagreen).format('0.00000'), '')[color] + ' ')
      }
      else {
        cols.push('                ')
      }
      return cols
    }
  }
}
