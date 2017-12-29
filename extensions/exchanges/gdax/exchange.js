var Gdax = require('gdax')
  , path = require('path')
  , colors = require('colors')
  , n = require('numbro')

module.exports = function container (get, set, clear) {
  var c = get('conf')

  var public_client = {}, authed_client

  function publicClient (product_id) {
    if (!public_client[product_id]) {
      public_client[product_id] = new Gdax.PublicClient(product_id, c.gdax.apiURI)
    }
    return public_client[product_id]
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
    if (resp.statusCode !== 200) {
      var err = new Error('non-200 status: ' + resp.statusCode)
      err.code = 'HTTP_STATUS'
      err.body = body
      return err
    }
  }

  function retry (method, args, err) {
    if (method !== 'getTrades') {
      console.error(('\nGDAX API is down! unable to call ' + method + ', retrying in 10s').red)
      if (err) console.error(err)
      console.error(args.slice(0, -1))
    }
    setTimeout(function () {
      exchange[method].apply(exchange, args)
    }, 10000)
  }

  var orders = {}

  var websocket_client

  var websocket_subscribed = false

  var websocket_quote = {bid: 0, ask: 0}

  var websocket_trades = []

  function websocketClient (product_ids) {
    if (c.gdax.websocket && c.gdax.websocket.enabled && !websocket_client) {
      var feed = c.gdax.websocket.feed || 'wss://ws-feed.gdax.com'
      var auth
      if (c.gdax && c.gdax.key && c.gdax.key !== 'YOUR-API-KEY') {
        auth = {key: c.gdax.key, secret: c.gdax.b64secret, passphrase: c.gdax.passphrase}
      }
      websocket_client = new Gdax.WebsocketClient(
        product_ids,
        feed,
        auth,
        {
          heartbeat: false, 
          channels: ['ticker', 'matches']
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
          websocket_quote.bid = message.best_bid
          websocket_quote.ask = message.best_ask
        } else if (message.type == 'match') {
          var max_length = (c.gdax.websocket.trade_history || 1000)
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

  var exchange = {
    name: 'gdax',
    historyScan: 'backward',
    makerFee: 0,
    takerFee: 0.3,

    getProducts: function () {
      return require('./products.json')
    },

    getTrades: function (opts, cb) {
      var func_args = [].slice.call(arguments)
      var self = this;
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
      if (!opts.to && websocketClient([opts.product_id]) && websocket_subscribed) {
        if (opts.from) {
          var trades = []
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
        var client = publicClient(opts.product_id)
        var args = {}
        if (opts.from) {
          // move cursor into the future
          args.before = opts.from
        }
        else if (opts.to) {
          // move cursor into the past
          args.after = opts.to
        }
        client.getProductTrades(args, function (err, resp, body) {
          if (!err) err = statusErr(resp, body)
          if (err) return cb(err, null)
          var trades = body.map(function (trade) {
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
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      client.getAccounts(function (err, resp, body) {
        if (!err) err = statusErr(resp, body)
        if (err) return retry('getBalance', func_args, err)
        var balance = {asset: 0, currency: 0}
        var split = 1
        body.forEach(function (account) {
          if (account.currency === opts.currency) {
            balance.currency = account.balance
            balance.currency_hold = account.hold
          }
          else if (account.currency === opts.asset) {
            balance.asset = account.balance
            balance.asset_hold = account.hold
          }
          else if (c.gdax.balance.split && c.gdax.balance.assets[account.currency] && c.gdax.balance.assets[account.currency] > account.balance) {
            split++
          }
        })
        if (c.gdax.balance.split && c.gdax.balance.assets[opts.asset] && c.gdax.balance.assets[opts.asset] < balance.asset) {
          balance.currency = 0
        }
        else {
          balance.currency = balance.currency /split
        }
        cb(null, balance)
      })
    },

    getQuote: function (opts, cb) {
      if (websocketClient([opts.product_id]) && websocket_quote.bid && websocket_quote.ask) {
        cb(null, websocket_quote)
        return
      }
      var func_args = [].slice.call(arguments)
      var client = publicClient(opts.product_id)
      client.getProductTicker(function (err, resp, body) {
        if (!err) err = statusErr(resp, body)
        if (err) return retry('getQuote', func_args, err)
        if (body.bid || body.ask)
          cb(null, {bid: body.bid, ask: body.ask})
        else
          cb(new Error(opts.product_id + ' has no liquidity to quote'))
      })
    },

    cancelOrder: function (opts, cb) {
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      client.cancelOrder(opts.order_id, function (err, resp, body) {
        if (body && (body.message === 'Order already done' || body.message === 'order not found')) return cb()
        if (!err) err = statusErr(resp, body)
        if (err) return retry('cancelOrder', func_args, err)
        cb()
      })
    },

    buy: function (opts, cb) {
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true
      }
      if (opts.order_type === 'taker') {
        opts.funds = n(opts.total).add(n(opts.total).multiply(this.takerFee).divide(100)).format('0.00000000')
        delete opts.price
        delete opts.size
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'market'
      }
      else {
        opts.time_in_force = 'GTT'
      }
      delete opts.order_type
      delete opts.total
      delete opts.orig_size
      delete opts.remaining_size
      delete opts.orig_price
      client.buy(opts, function (err, resp, body) {
        if (body && body.message === 'Insufficient funds') {
          var order = {
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
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true
      }
      if (opts.order_type === 'taker') {
        delete opts.price
        delete opts.post_only
        delete opts.cancel_after
        opts.type = 'market'
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
        if (body && body.message === 'Insufficient funds') {
          var order = {
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
      var func_args = [].slice.call(arguments)
      var client = authedClient()
      client.getOrder(opts.order_id, function (err, resp, body) {
        if (!err && resp.statusCode !== 404) err = statusErr(resp, body)
        if (err) return retry('getOrder', func_args, err)
        if (resp.statusCode === 404) {
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
