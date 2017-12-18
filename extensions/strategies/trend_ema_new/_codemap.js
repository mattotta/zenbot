module.exports = {
  _ns: 'zenbot',

  'strategies.trend_ema_new': require('./strategy'),
  'strategies.list[]': '#strategies.trend_ema_new'
}
