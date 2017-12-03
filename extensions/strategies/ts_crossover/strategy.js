var z = require('zero-fill')
  , n = require('numbro')

var data = "";
module.exports = function container (get, set, clear) {
  return {
    name: 'ts_crossover',
    description: 'Testing indicator crossover',

    getOptions: function () {
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('trend_ema', 'number of periods for trend EMA', Number, 20)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 0.06)
      this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 20)
      this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 30)
      
      // new params
      this.option('cmo_length', 'CMO length, default 34', Number, 13)
      this.option('adx_length', 'ADX length, default 34', Number, 13)

      this.option('sma_length', 'SMA length, default 34', Number, 13)
      this.option('cmo_sma', 'cmo sma, default 6', Number, 6)
    },
    
    calculate: function (s) {

      get('lib.ta_cmo')(s, 'ta_cmo', s.options.cmo_length, "close")
      
      if(s.period["ta_cmo"]){
          //get('lib.sma')(s, 'ta_cmo_sma', s.options.cmo_sma, "ta_cmo")
          // console.log("period: ",s.period);
          //debugger;
          
          get('lib.ta_adx')(s, 'ta_adx', s.options.adx_length)
         
          
          if(s.period.ta_adx){
            //debugger;
            //console.log("cmo: " + s.period.ta_cmo + ", adx: " + s.period.ta_adx);
            //console.log(s.period.ta_cmo + "," + s.period.ta_adx)
          }
      }      
    },

    onPeriod: function (s, cb) {
      //debugger;
      
      if (!s.in_preroll && typeof s.period.oversold_rsi === 'number') {
        if (s.oversold) {
          s.oversold = false
          s.trend = 'oversold'
          s.signal = 'buy'
          s.cancel_down = true
          return cb()
        }
      }
      if (typeof s.period.ta_adx === 'number') {
        if (s.period.ta_adx > s.period.ta_cmo) {
          if (s.trend !== 'up') {
            s.acted_on_trend = false
          }
          s.trend = 'up'
          s.signal = !s.acted_on_trend ? 'buy' : null
          s.cancel_down = false
        }
        else if (!s.cancel_down && s.period.ta_adx < (s.period.ta_cmo * -1)) {
          if (s.trend !== 'down') {
            s.acted_on_trend = false
          }
          s.trend = 'down'
          s.signal = !s.acted_on_trend ? 'sell' : null
        }
      }
      cb()
    },

    onReport: function (s) {
      var cols = []
      if (typeof s.period.ta_adx === 'number') {
        var color = 'grey'
        if (s.period.ta_cmo > s.period.ta_adx) {
          color = 'green'
        }else if (s.period.ta_cmo < (s.period.ta_adx * -1)) {
          color = 'red'
        }
        
        cols.push(z(8, n(s.period.ta_cmo - s.period.ta_adx).format('0.000000'), ' ')['red'])
        
        if (s.period.ta_cmo) {
          cols.push(z(8, n(s.period.ta_adx).format('0.0000'), ' ')[color])
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
