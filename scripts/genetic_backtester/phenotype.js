/*
 * Zenbot 4 Genetic Backtester
 * Clifford Roche <clifford.roche@gmail.com>
 * 07/01/2017
 */

let PROPERTY_MUTATION_CHANCE = 0.30;
let PROPERTY_CROSSOVER_CHANCE = 0.50;

module.exports = {
  create: function(strategy) {
    var r = {};
    for (var k in strategy) {
      var v = strategy[k];
      if (v.type === 'int') {
        r[k] = Math.floor((Math.random() * (v.max - v.min + 1)) + v.min);
      } else if (v.type === 'int0') {
        r[k] = 0;
        if (Math.random() >= 0.5) {
          r[k] = Math.floor((Math.random() * (v.max - v.min + 1)) + v.min);
        }
      } else if (v.type === 'float') {
        r[k] = (Math.random() * (v.max - v.min)) + v.min;
      } else if (v.type === 'makertaker') {
        r[k] = (Math.random() > 0.5) ? 'maker' : 'taker';
      } else if (v.type === 'maker') {
        r[k] = 'maker';
      } else if (v.type === 'taker') {
        r[k] = 'taker';
      } else if (v.type === 'neutral_rate') {
        var items = ['auto', 'auto_trend'];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'neutral_rate_reverse') {
        var items = ['auto', 'auto_trend', 'auto_new'];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'neutral_rate_min') {
        var items = [0, 0.1, 0.01, 0.001, 0.0001];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'sigmoidtanhrelu') {
        var items = ['sigmoid', 'tanh', 'relu'];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'period') {
        var items = ['1s', '2s', '3s', '5s', '7s', '9s', '12s', '15s', '18s', '22s', '26s', '30s', '36s', '48s', '60s', '75s', '90s','2m', '3m', '5m', '7m', '9m', '12m', '15m', '18m', '22ms', '26m', '30m', '36m', '48s', '60m', '75m', '90m']
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'selector') {
        var index = Math.floor(Math.random() * v.items.length);
        r[k] = v.items[index];
      }
    }
    return r;
  },

  mutation: function(oldPhenotype, strategy) {
    var r = module.exports.create(strategy);
    for (var k in oldPhenotype) {
      if (k === 'sim') continue;

      var v = oldPhenotype[k];
      r[k] = (Math.random() < PROPERTY_MUTATION_CHANCE) ? r[k] : oldPhenotype[k];
    }
    return r;
  },

  crossover: function(phenotypeA, phenotypeB, strategy) {
    var p1 = {};
    var p2 = {};

    for (var k in strategy) {
      if (k === 'sim') continue;

      p1[k] = Math.random() >= PROPERTY_CROSSOVER_CHANCE ? phenotypeA[k] : phenotypeB[k];
      p2[k] = Math.random() >= PROPERTY_CROSSOVER_CHANCE ? phenotypeA[k] : phenotypeB[k];
    }

    return [p1, p2];
  },

  fitness: function(phenotype) {
    if (typeof phenotype.sim === 'undefined') return 0;
    
    var vsBuyHoldRate = (phenotype.sim.vsBuyHold / 50);
    var wlRatioRate = 1.0 / (1.0 + Math.pow(2.71828, -(phenotype.sim.wins - phenotype.sim.losses)));
    var rate = vsBuyHoldRate * (wlRatioRate);
    return rate;
  },

  competition: function(phenotypeA, phenotypeB) {
    // TODO: Refer to geneticalgorithm documentation on how to improve this with diverstiy
    return module.exports.fitness(phenotypeA) >= module.exports.fitness(phenotypeB);
  }
};
