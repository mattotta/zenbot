var talib = require('talib')

module.exports = function container (get, set, clear) {
  return function ta_sma (s, key, length, source_key, sma_days) {
    //create object for talib. only close is used for now but rest might come in handy
    if (!s.marketData) {
      s.marketData = { open: [], close: [], high: [], low: [], volume: [], ta_cmo: [] };
    }
    
    // add actual market data to marketData template object
    if (s.lookback.length > s.marketData.close.length) {
      for (var i = (s.lookback.length - s.marketData.close.length) - 1; i >= 0; i--) {
        //console.log('add data')
        s.marketData.open.push(s.lookback[i].open);
        s.marketData.close.push(s.lookback[i].close);
        s.marketData.high.push(s.lookback[i].high);
        s.marketData.low.push(s.lookback[i].low);
        s.marketData.volume.push(s.lookback[i].volume);
      }
    }
    
    //dont calculate until we have enough data
    if (s.marketData.close.length >= length) {
      //fillup marketData for talib.
      //this might need improvment for performance.
      //for (var i = 0; i < length; i++) {
      //  s.marketData.close.push(s.lookback[i].close);
      //}
      //fillup marketData for talib.
      
      var tmpMarket
      if(source_key){
        tmpMarket = JSON.parse(JSON.stringify(s.marketData[source_key]));
        //tmpMarket.push(s.period[[source_key]])
      } else {        
        tmpMarket = JSON.parse(JSON.stringify(s.marketData.close));
        tmpMarket.push(s.period.close)
      }
      
      if (tmpMarket.length >= length) {
        talib.execute({
          name: "SMA",
          startIdx: 0,
          endIdx: tmpMarket.length -1,
          inReal: tmpMarket,
          optInTimePeriod: length //From 2 to 100000
        }, (err, result) =>{          
          if (err) {
            console.log(err);
            return;
          }
          
          //s.marketData.ta_cmo.push(result.result.outReal[(result.nbElement - 1)]);
          s.period[key] = result.result.outReal[(result.nbElement - 1)];          
        });
      }
    }
  }
}
