/*
 * Zenbot 4 Genetic Backtester
 * Clifford Roche <clifford.roche@gmail.com>
 * 07/01/2017
 */

let roundp = require('round-precision')
let uuidv4 = require('uuid/v4')

let PROPERTY_MUTATION_CHANCE = 0.30
let PROPERTY_CROSSOVER_CHANCE = 0.50

module.exports = {
  create: function(strategy) {
    let r = {}
    for (let k in strategy) {
      let v = strategy[k]
      if (v.type === 'int') {
        r[k] = Math.floor((Math.random() * (v.max - v.min + 1)) + v.min)
      } else if (v.type === 'int0') {
        r[k] = 0
        if (Math.random() >= 0.25) {
          r[k] = Math.floor((Math.random() * (v.max - v.min + 1)) + v.min)
        }
      } else if (v.type === 'intfactor') {
        // possible 0 value by providing min 0
        if (v.min == 0 && Math.random() <= 0.5) r[k] = 0
        else r[k] = Math.round(Math.random() * (v.max - v.min + 1)/v.factor)*v.factor
      } else if (v.type === 'float') {
        r[k] = (Math.random() * (v.max - v.min)) + v.min
        if (v.precision) r[k] = roundp(r[k], v.precision)
      } else if (v.type === 'makertaker') {
        r[k] = (Math.random() > 0.5) ? 'maker' : 'taker'
      } else if (v.type === 'period_length' || v.type === 'period') {
        let s = Math.floor((Math.random() * (v.max - v.min + 1)) + v.min)
        r[k] = s + v.period
      } else if (v.type === 'items') {
        let index = Math.floor(Math.random() * v.items.length)
        r[k] = v.items[index]
      }
    }
    r['uuid'] = uuidv4()
    r['places'] = []
    return r
  },

  mutation: function(oldPhenotype, strategy) {
    let r = module.exports.create(strategy)

    for (let k in r) {
      if (k !== 'uuid' && k !== 'places') {
        if (Math.random() > PROPERTY_MUTATION_CHANCE) {
          r[k] = oldPhenotype[k]
        }
      }
    }

    return r
  },

  crossover: function(phenotypeA, phenotypeB, strategy) {
    let r = module.exports.create(strategy)

    for (let k in r) {
      if (k !== 'uuid' && k !== 'places') {
        if (Math.random() >= PROPERTY_CROSSOVER_CHANCE) {
          r[k] = phenotypeA[k]
        } else {
          r[k] = phenotypeB[k]
        }
      }
    }

    return r
  },

  fitness: function(phenotype) {
    if (typeof phenotype.sim === 'undefined') return 0

    if (typeof phenotype.sim.fitness !== 'undefined') return phenotype.sim.fitness

    var vsBuyHoldRate = (phenotype.sim.vsBuyHold / 50)
    var wlRatio = phenotype.sim.wins / phenotype.sim.losses
    if(isNaN(wlRatio)) { // zero trades will result in 0/0 which is NaN
      wlRatio = 1
    }
    var wlRatioRate = 1.0 / (1.0 + Math.pow(Math.E, -wlRatio))
    var rate = vsBuyHoldRate * (wlRatioRate)
    return rate
  },

  place: function(phenotype) {
    if (typeof phenotype.sim === 'undefined') return 0

    if (typeof phenotype.sim.place !== 'undefined') return phenotype.sim.place

    if (typeof phenotype.sim.places === 'undefined'|| phenotype.sim.places.length === 0) return 0

    return phenotype.sim.places.reduce((a, b) => a + b)
  },

  competition: function(phenotypeA, phenotypeB) {
    let placeA = module.exports.place(phenotypeA)
    let placeB = module.exports.place(phenotypeB)
    if (placeA === placeB) {
      return module.exports.fitness(phenotypeA) >= module.exports.fitness(phenotypeB)
    } else {
      return placeA <= placeB
    }
  }
}
