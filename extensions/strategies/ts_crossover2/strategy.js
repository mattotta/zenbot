var z = require('zero-fill')
  , n = require('numbro')
  //, fs = require('fs'), fs_started = false
;


var data = "";
/*
if(!fs_started) {
  fs.appendFile('log.csv', 'pid'+','+'pOpen'+','+'pClose'+','+'greent'+','+'purplet'+','+'redt'+'\n', (err)=>{});
  fs_started = true;
}//*/
module.exports = function container (get, set, clear) {
  return {
    name: 'ts_crossover2',
    description: 'Testing indicator patterns',

    getOptions: function () {
      // these are relative to period length. Good tests so far: period=5m or 90m
      this.option('emalen1', 'Length of EMA 1', Number, 20 )
      this.option('smalen1', 'Length of SMA 1', Number, 20 )
      this.option('smalen2', 'Length of SMA 2', Number, 10 )      
    },
    
    /*
    ./zenbot.sh sim --days=2 --avg_slippage_pct=0.5 --period=2m --profit_stop_enable_pct=7.5 --profit_stop_pct=1 --strategy=ts_crossover
    env node zenbot.js sim --days=90 --strategy=ts_crossover2 --period="5m" --asset_capital=0 --currency_capital=0.05 --profit_stop_enable_pct=0 --max_sell_loss_pct=10000 --avg_slippage_pct=0 
    
    */
    calculate: function (s) {
        // compute MACD
        get('lib.ema')(s, 'ema1', s.options.emalen1)
        get('lib.sma')(s, 'sma1', s.options.smalen1)
        get('lib.sma')(s, 'sma2', s.options.smalen2)
    },
    
    onPeriod: function (s, cb) { 
      let pOpen = s.period.open,
        pClose = s.period.close;
        greent = s.period.ema1,
        redt = s.period.sma1,
        purplet= s.period.sma2;
        
     var trendUp = function(s, cancel){
        if (s.trend !== 'up') {
          s.acted_on_trend = false
        }
        s.trend = 'up'
        s.signal = !s.acted_on_trend ? 'buy' : null
        s.cancel_down = false

        if(cancel)
          s.cancel_down = true
      },
      trendDown = function(s){
        if (s.trend !== 'down') {
          s.acted_on_trend = false
        }
        s.trend = 'down'
        s.signal = !s.acted_on_trend ? 'sell' : null
      };
      
      //if(emaLO && emaSO) debugger;
      if(greent && redt && purplet && pOpen && pClose){
        //fs.appendFile('simulations/log.csv', s.period.period_id+','+pOpen+','+pClose+','+greent+','+purplet+','+redt+'\n', (err)=>{});


/*
        success: 
        raedt = s.period.ema1,
        gareent = s.period.sma1,
        paurplet = s.period.sma2;
        if(
            (raedt > paurplet)
        ) trendDown(s)
        
        if(
             (raedt < paurplet)
        ) trendUp(s, true)
        
        
        not bad:
        if(
               (greent < purplet)
          ) trendUp(s, true)
        else trendDown(s)
          
        if(
             (redt > purplet)
         // && (greent < redt)
        ) trendDown(s)
        else trendUp(s, true)
        
        */
        if(
               (greent < purplet)
            || (redt < purplet)
          ) trendUp(s, true)
        else trendDown(s)
          
        if(
             (redt > purplet)
            || (redt > greent)
         // && (greent < redt)
        ) trendDown(s)
        else trendUp(s, true)
        
                
        //if((purplet > greent) && (redt < purplet)) trendDown(s)
        //if((purplet > redt) && (purplet > greent)) trendDown(s)
      }
      cb()
    },

    onReport: function (s) {
      var cols = []
      let pOpen = s.period.open,
        pClose = s.period.open;
        emaSO = s.period.ema_short_o,
        emaLO = s.period.ema_long_o,
        emaSC = s.period.ema_short_c,
        emaLC = s.period.ema_long_c;
      
      
      if (typeof emaLO != 'undefined' && typeof emaLC != 'undefined') {
        var color = 'grey'
        if (emaSC > emaLO)
          color = 'green'
        else if (pClose < (pOpen * -1)) 
          color = 'red'
        
        cols.push(z(8, n(emaSC).format('0.00000'), ' ')['blue'])
        cols.push(z(8, n(emaLC).format('0.00000'), ' ')['blue'])
 
      }
      else {
        if (s.period.trend_ema_stddev) {
          cols.push('                  ')
        }
        else {
          cols.push('        ')
        }
      }
      return cols
    }
  }
}
