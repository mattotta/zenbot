var talib = require('talib')

module.exports = function container (get, set, clear) {
  return function ta_cmo (s, key, length, source_key) {
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
      
      var tmpMarket
      if(source_key){
        tmpMarket = JSON.parse(JSON.stringify(s.marketData[source_key]));
        tmpMarket.push(s.period[[source_key]])
      } else {        
        tmpMarket = JSON.parse(JSON.stringify(s.marketData.close));
        tmpMarket.push(s.period.close)
      }
      
      //doublecheck length.
      if (tmpMarket.length >= length) {
        talib.execute({
          name: "CMO",
          startIdx: 0,
          endIdx: tmpMarket.length -1,
          inReal: tmpMarket,
          optInTimePeriod: length //From 2 to 100000
        }, (err, result) =>{          
          if (err) {
            console.log(err);
            return;
          }
          
          s.marketData.ta_cmo.push(result.result.outReal[(result.nbElement - 1)]);
          s.period[key] = result.result.outReal[(result.nbElement - 1)];
          
          
          /*
          // yay nested callback hell begins
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
            
            s.period[key+'_sma'] = result.result.outReal[(result.nbElement - 1)];
          })//*/
          
        });
      }
    }
  }
}
