let Gdax = require('gdax')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  let c = get('conf')

  let public_client, authed_client

  function publicClient () {
    if (!public_client) {
      public_client = new Gdax.PublicClient(c.gdax.apiURI)
    }
    return public_client
  }

  function authedClient () {
    if (!authed_client) {
      if (!c.gdax || !c.gdax.key || c.gdax.key === 'YOUR-API-KEY') {
        throw new Error('please configure your GDAX credentials in conf.js')
      }
      authed_client = new Gdax.AuthenticatedClient(c.gdax.key, c.gdax.b64secret, c.gdax.passphrase, c.gdax.apiURI)
    }
    return authed_client
  }

  function statusErr (resp, body) {
    if (resp && resp.statusCode !== 200) {
      let err = new Error('non-200 status: ' + resp.statusCode)
      err.code = 'HTTP_STATUS'
      err.body = body
      return err
    }
  }

  function retry (method, args, err) {
    if (method !== 'getTrades') {
      console.error(('\nGDAX API is down! unable to call ' + method + ', retrying in 10s').red)
      // if (err) console.error(err)
      // console.error(args.slice(0, -1))
    }
    setTimeout(function () {
      exchange[method].apply(exchange, args)
    }, 10000)
  }

  let orders = {}

  let quotes = {}

  let websocket_client

  let websocket_subscribed = false

  let websocket_trades = []

  function websocketClient(product_id) {
    if (c.gdax.websocket && c.gdax.websocket.enabled && !websocket_client) {
      let feed = c.gdax.websocket.feed || 'wss://ws-feed.gdax.com'
      let auth
      if (c.gdax && c.gdax.key && c.gdax.key !== 'YOUR-API-KEY') {
        auth = {key: c.gdax.key, secret: c.gdax.b64secret, passphrase: c.gdax.passphrase}
      }
      let channels = ['ticker', 'matches']
      if (c.gdax.balance.split) {
        let product_ids = []
        let currency = product_id.split('-').pop()
        c.gdax.balance.assets.forEach(function (asset) {
          product_ids.push(asset + '-' + currency)
        })
        channels = ['matches', { name: 'ticker', product_ids: product_ids }]
      }
      websocket_client = new Gdax.WebsocketClient(
        [product_id],
        feed,
        auth,
        {
          heartbeat: false,
          channels: channels
        }
      )
      websocket_client.on('open', function () {
        websocket_subscribed = true
      })
      websocket_client.on('close', function () {
        websocket_client = null
        websocket_subscribed = false
      })
      websocket_client.on('error', function (err) {
        console.error(err)
      })
      websocket_client.on('message', function (message) {
        if (message.type == 'ticker') {
          quotes[message.product_id] = {
            bid: message.best_bid,
            ask: message.best_ask,
            price: message.price
          }
        } else if (message.type == 'match') {
          let max_length = (c.gdax.websocket.trade_history || 1000)
          if (websocket_trades.length > max_length ) {
            websocket_trades.shift()
          }
          websocket_trades.push({
            trade_id: message.trade_id,
            time: new Date(message.time).getTime(),
            size: Number(message.size),
            price: Number(message.price),
            side: message.side
          })
        }
      })
    }
    return websocket_client
  }

  let exchange = {
    name: 'gdax',
    historyScan: 'backward',
    makerFee: 0,
    takerFee: 0.3,

    getProducts: function () {
      return require('./products.json')
    },

    getTrades: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let self = this
      this.getProductTrades(opts, function (err, trades) {
        if (err) return retry('getTrades', func_args, err)
        if (trades.length) {
          trades.sort(function (a, b) {
            if (a.time > b.time) return -1
            if (a.time < b.time) return 1
            if (a.trade_id > b.trade_id) return -1
            if (a.trade_id < b.trade_id) return 1
            return 0
          })
          if ((!opts.time || (opts.time && opts.time == trades[0].time)) && trades[0].time == trades[trades.length - 1].time) {
            if (!opts.time) {
              opts.time = trades[0].time
            }
            if (opts.from) {
              // move cursor into the future
              opts.from = self.getCursor(trades[0])
            }
            else if (opts.to) {
              // move cursor into the past
              opts.to = self.getCursor(trades[trades.length - 1])
            }
            // get possible additional trades for same timestamp
            self.getTrades(opts, function (err, next) {
              while (next.length && next[next.length - 1].time != opts.time) {
                next.pop()
              }
              if (next.length) {
                trades = next.concat(trades)
              }
              cb(null, trades)
            })
            return
          }
        }

        cb(null, trades)
      })
    },

    getProductTrades: function(opts, cb) {
      if (!opts.to && websocketClient(opts.product_id) && websocket_subscribed) {
        if (opts.from) {
          let trades = []
          websocket_trades.forEach(function (trade)  {
            if (trade.trade_id > opts.from) {
              trades.push(trade)
            }
          })
          cb(null, trades)
        } else {
          cb(null, websocket_trades)
        }
      } else {
        let client = publicClient()
        let args = {}
        if (opts.from) {
          // move cursor into the future
          args.before = opts.from
        }
        else if (opts.to) {
          // move cursor into the past
          args.after = opts.to
        }
        client.getProductTrades(opts.product_id, args, function (err, resp, body) {
          if (!resp && err && err.response) resp = err.response
          if (!body && err && err.data) body = err.data
          if (!err) err = statusErr(resp, body)
          if (err) return cb(err, null)
          let trades = body.map(function (trade) {
            return {
              trade_id: trade.trade_id,
              time: new Date(trade.time).getTime(),
              size: Number(trade.size),
              price: Number(trade.price),
              side: trade.side
            }
          })
          cb(null, trades)
        })
      }
    },

    getBalance: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let self = this
      let client = authedClient()
      client.getAccounts(function (err, resp, body) {
        if (!err) err = statusErr(resp, body)
        if (err) return retry('getBalance', func_args, err)
        let balance = {asset: 0, asset_hold: 0, currency: 0, currency_hold: 0}
        body.forEach(function (account) {
          if (account.currency === opts.currency) {
            balance.currency = account.balance
            balance.currency_hold = account.hold
          }
          else if (account.currency === opts.asset) {
            balance.asset = account.balance
            balance.asset_hold = account.hold
          }
        })
        if (!c.gdax.balance.split) {
          cb(null, balance)
        } else {
          let shares = c.gdax.balance.assets.length
          let total = n(balance.currency).value()
          let balances = { count: 0 }
          let calculateBalance = function(_asset, _balance, _price) {
            balances[_asset] = n(_balance).multiply(_price).value()
            balances.count++
            total = n(total).add(balances[_asset]).value()
            if (balances.count === shares) {
              let share = n(total).divide(shares).value()
              c.gdax.balance.assets.forEach(function (asset) {
                if (balances[asset] > share) {
                  total = n(total).subtract(balances[asset])
                  shares--
                }
              })
              balance.currency = Math.max(0, Math.min(balance.currency, n(total).divide(shares).subtract(balances[opts.asset]).value()))
              cb(null, balance)
            }
          }
          self.getQuote({product_id: opts.asset + '-' + opts.currency, cached: true}, function(err, quote) {
            calculateBalance(opts.asset, balance.asset, quote.price)
          })
          body.forEach(function (account) {
            if (account.currency !== opts.asset && c.gdax.balance.assets.indexOf(account.currency) !== -1) {
              self.getQuote({product_id: account.currency + '-' + opts.currency, cached: true}, function(err, quote) {
                calculateBalance(account.currency, account.balance, quote.price)
              })
            }
          })
        }
      })
    },

    getQuote: function (opts, cb) {
      if (opts.cached === true &&
        websocketClient(opts.product_id) &&
        quotes[opts.product_id] &&
        quotes[opts.product_id].bid &&
        quotes[opts.product_id].ask) {
        cb(null, quotes[opts.product_id])
        return
      }
      let func_args = [].slice.call(arguments)
      let client = publicClient()
      client.getProductTicker(opts.product_id, function (err, resp, body) {
        if (!resp && err && err.response) resp = err.response
        if (!body && err && err.data) body = err.data
        if (!err) err = statusErr(resp, body)
        if (err) return retry('getQuote', func_args, err)
        if (body.bid || body.ask) {
          quotes[opts.product_id] = {
            bid: body.bid,
            ask: body.ask,
            price: body.price
          }
          cb(null, quotes[opts.product_id])
        } else
          cb(new Error(opts.product_id + ' has no liquidity to quote'))
      })
    },

    cancelOrder: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let client = authedClient()
      client.cancelOrder(opts.order_id, function (err, resp, body) {
        if (!resp && err && err.response) resp = err.response
        if (!body && err && err.data) body = err.data
        if (body && (body.message === 'Order already done' || body.message === 'order not found')) return cb()
        if (body && body.indexOf(opts.order_id) !== -1) return cb()
        if (!err) err = statusErr(resp, body)
        if (err) return retry('cancelOrder', func_args, err)
        cb()
      })
    },

    buy: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let client = authedClient()
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true
      }
      if (opts.order_type === 'taker') {
        opts.funds = n(opts.total).add(n(opts.total).multiply(this.takerFee).divide(100)).format(opts.increment, Math.floor)
        delete opts.price
        delete opts.size
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'market'
      }
      else if (opts.order_type === 'stop') {
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'stop'
      }
      else {
        opts.time_in_force = 'GTT'
      }
      delete opts.order_type
      delete opts.total
      delete opts.orig_size
      delete opts.remaining_size
      delete opts.orig_price
      delete opts.increment
      client.buy(opts, function (err, resp, body) {
        if (!resp && err && err.response) resp = err.response
        if (!body && err && err.data) body = err.data
        if (body && body.message === 'Insufficient funds') {
          let order = {
            status: 'rejected',
            reject_reason: 'balance'
          }
          return cb(null, order)
        }
        if (!err) err = statusErr(resp, body)
        if (err) return retry('buy', func_args, err)
        orders['~' + body.id] = body
        cb(null, body)
      })
    },

    sell: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let client = authedClient()
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true
      }
      if (opts.order_type === 'taker') {
        delete opts.price
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'market'
      }
      else if (opts.order_type === 'stop') {
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'stop'
      }
      else {
        opts.time_in_force = 'GTT'
      }
      delete opts.order_type
      delete opts.total
      delete opts.orig_size
      delete opts.remaining_size
      delete opts.orig_price
      client.sell(opts, function (err, resp, body) {
        if (!resp && err && err.response) resp = err.response
        if (!body && err && err.data) body = err.data
        if (body && body.message === 'Insufficient funds') {
          let order = {
            status: 'rejected',
            reject_reason: 'balance'
          }
          return cb(null, order)
        }
        if (!err) err = statusErr(resp, body)
        if (err) return retry('sell', func_args, err)
        orders['~' + body.id] = body
        cb(null, body)
      })
    },

    getOrder: function (opts, cb) {
      let func_args = [].slice.call(arguments)
      let client = authedClient()
      client.getOrder(opts.order_id, function (err, resp, body) {
        if (!resp && err && err.response) resp = err.response
        if (!body && err && err.data) body = err.data
        if (!resp || resp.statusCode !== 404) {
          if (!err) err = statusErr(resp, body)
          if (err) return retry('getOrder', func_args, err)
        } else {
          // order was cancelled. recall from cache
          body = orders['~' + opts.order_id]
          body.status = 'done'
          body.done_reason = 'canceled'
        }
        if (typeof body.size === 'undefined' && body.filled_size) {
          body.size = body.filled_size
        }
        if (typeof body.fees === 'undefined' && body.fill_fees) {
          body.fees = body.fill_fees
        }
        if (typeof body.total === 'undefined' && body.executed_value) {
          body.total = body.executed_value
        }
        if (typeof body.price === 'undefined' && body.total && body.size) {
          body.price = n(body.executed_value).divide(body.filled_size).format('0.00000000')
        }
        cb(null, body)
      })
    },

    // return the property used for range querying.
    getCursor: function (trade) {
      return trade.trade_id
    }
  }
  return exchange
}
