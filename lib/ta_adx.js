var talib = require('talib')

module.exports = function container (get, set, clear) {
  return function ta_adx (s, key, length, source_key) {
    //create object for talib. only close is used for now but rest might come in handy
    if (!s.marketData) {
      s.marketData = { open: [], close: [], high: [], low: [], volume: [] };
    }
    
    // add actual market data to marketData template object
    if (s.lookback.length > s.marketData.close.length) {
      
      for (var i = (s.lookback.length - s.marketData.close.length) - 1; i >= 0; i--) {
        //console.log('add data')
        s.marketData.close.push(s.lookback[i].close);
        s.marketData.high.push(s.lookback[i].high);
        s.marketData.low.push(s.lookback[i].low);
      }
    }
    
    
    //dont calculate until we have enough data
    if (s.marketData.close.length >= length) {
      //console.log("lookback len: " + s.lookback.length + ", marketclose len: " + s.marketData.close.length);
      
      //debugger;
      
      //fillup marketData for talib.
      //this might need improvment for performance.
      //for (var i = 0; i < length; i++) {
      //  s.marketData.close.push(s.lookback[i].close);
      //}
      //fillup marketData for talib.
      var tmpMarket = JSON.parse(JSON.stringify(s.marketData.close));
      //add current period
      tmpMarket.push(s.period.close)

      if (tmpMarket.length >= length) {
        talib.execute({
          name: "ADX",
          startIdx: 0,
          endIdx: s.marketData.close.length -1,
          high: s.marketData.high,
          low: s.marketData.low,
          close: s.marketData.close,
          optInTimePeriod: length //From 2 to 100000
        }, function (err, result) {    
                
          if (err) {
            console.log(err);
            return;
          }
          s.period[key] = result.result.outReal[(result.nbElement - 1)];
        });
      }
    }
  }
}
