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
      } else if (v.type === 'intfactor') {
        // possible 0 value by providing min 0
      	if (v.min == 0 && Math.random() <= 0.5) r[k] = 0;
        else r[k] = Math.round(Math.random() * (v.max - v.min + 1)/v.factor)*v.factor;
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
        var items = [0, 0.0001, 0.0002, 0.0003, 0.0004, 0.0005, 0.0006, 0.0007, 0.0008, 0.0009, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'neutral_rate_min_new') {
        var items = [0, 0.0001, 0.0002, 0.0003, 0.0004, 0.0005, 0.0006, 0.0007, 0.0008, 0.0009, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
        do  {
          var index1 = Math.floor(Math.random() * items.length);
          var index2 = Math.floor(Math.random() * items.length);
        } while (index1 >= index2)
        r[k] = [items[index1], items[index2]].sort().join(',');
      } else if (v.type === 'sigmoidtanhrelu') {
        var items = ['sigmoid', 'tanh', 'relu'];
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'period') {
        var items = ['1s', '3s', '5s', '10s', '15s', '20s', '30s', '45s', '60s', '90s', '2m', '3m', '5m', '10m', '15m', '20m', '30m', '45s', '60m', '90m', '120m']
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'period_long') {
        var items = ['1m', '2m', '3m', '5m', '10m', '15m', '20m', '30m', '45s', '60m', '90m', '120m']
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'period_short') {
        var items = ['1s', '3s', '5s', '10s', '15s', '20s', '30s', '45s', '60s', '90s', '120s']
        var index = Math.floor(Math.random() * items.length);
        r[k] = items[index];
      } else if (v.type === 'items') {
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
