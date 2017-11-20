module.exports = {
  _ns: 'zenbot',

  'strategies.reverse_trend_ema': require('./strategy'),
  'strategies.list[]': '#strategies.reverse_trend_ema'
}
