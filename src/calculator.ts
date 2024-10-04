export interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
}

export function tally(rates: RateLimit[]) {
  return rates.reduce((acc, rate) => {
    return {
      cost: acc.cost + rate.nodeCount,
      nodeCount: acc.nodeCount + rate.nodeCount,
    }
  }, {
    cost: 0,
    nodeCount: 0,
  });
}
