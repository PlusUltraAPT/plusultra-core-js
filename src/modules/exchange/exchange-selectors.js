// @flow

import type { RootState } from '../root-reducer.js'

export type GetPairCost = (
  source: string,
  age: number,
  inverse: boolean
) => number

/**
 * Recursively searches for the best exchange rate.
 */
function searchRoutes (search, fromCurrency, parentRate, blacklist) {
  // If we reach our target, we are done:
  if (fromCurrency === search.toCurrency) {
    search.bestRate = parentRate
  }

  // Never re-visit the same currency:
  blacklist = { ...blacklist }
  blacklist[fromCurrency] = true

  // Iterate over all the currencies we can convert to from here:
  for (const currency of Object.keys(search.routes[fromCurrency])) {
    // Skip this currency if it is on the blacklist:
    if (blacklist[currency]) continue

    // Of all the pairs that bring us to this currency, find the best one:
    let ourRate = { rate: 0, cost: Infinity }
    const indices = search.routes[fromCurrency][currency]
    for (const i of indices) {
      const pair = search.pairs[i]
      const inverse = pair.fromCurrency !== fromCurrency
      const cost =
        parentRate.cost +
        search.getPairCost(pair.source, search.now - pair.timestamp, inverse)

      // Save this rate if it has a better score:
      if (cost < ourRate.cost) {
        const rate = inverse
          ? parentRate.rate / pair.rate
          : parentRate.rate * pair.rate
        ourRate = { rate, cost }
      }
    }

    // Only recurse if we have a better score:
    if (ourRate.cost < search.bestRate.cost) {
      searchRoutes(search, currency, ourRate, blacklist)
    }
  }
}

function startRouteSearch (
  routes,
  pairs,
  fromCurrency,
  toCurrency,
  getPairCost
) {
  const search = {
    // Search constants:
    now: Date.now() / 1000,
    routes,
    pairs,
    toCurrency,
    getPairCost,

    // The search overwrites this as it finds better rates:
    bestRate: { rate: 0, cost: Infinity }
  }

  // Only search if the endpoints exist:
  if (search.routes[fromCurrency] && search.routes[toCurrency]) {
    searchRoutes(search, fromCurrency, { rate: 1, cost: 0 }, {})
  }

  return search.bestRate.rate
}

/**
 * Looks up the best available exchange rate.
 * @param {*} getPairCost a function that assigns scores to currency pairs.
 * Higher scores are worse. The scores add, so longer paths have higher costs
 * than shorter paths. The signature is `(source, age, inverse) => cost`.
 */
export function getExchangeRate (
  state: RootState,
  fromCurrency: string,
  toCurrency: string,
  getPairCost: GetPairCost
) {
  return startRouteSearch(
    state.exchangeCache.rates.routes,
    state.exchangeCache.rates.pairs,
    fromCurrency,
    toCurrency,
    getPairCost
  )
}
