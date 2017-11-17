module.exports = {
  _ns: 'zenbot',

  'strategies.trend_ema_reverse': require('./strategy'),
  'strategies.list[]': '#strategies.trend_ema_reverse'
}
