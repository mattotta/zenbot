module.exports = function container (get, set, clear) {
  return function stddev (s, key, length, source_key) {
    if (typeof s.period[source_key] === 'number') {
      var sum = s.period[source_key]
      var sum_len = 1
      s.lookback.slice(0, length).some(function (period) {
        if (typeof period[source_key] === 'number') {
          sum += period[source_key]
          sum_len++
        } else {
          return true
        }
      })
      var avg = sum / sum_len
      var var_sum = 0
      s.lookback.slice(0, sum_len).some(function (period) {
        var_sum += Math.pow(period[source_key] - avg, 2)
      })
      var variance = var_sum / sum_len
      s.period[key] = Math.sqrt(variance)
    }
  }
}
