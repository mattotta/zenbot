module.exports = {
  _ns: 'zenbot',

  'strategies.multi_ema': require('./strategy'),
  'strategies.list[]': '#strategies.multi_ema'
}
