export interface RateLimit {
  cost: number;
  remaining: number;
  nodeCount: number;
}

export function tally(rates: RateLimit[]) {
  const tallied = rates.reduce((acc, rate) => {
    return {
      cost: acc.cost + rate.cost,
      nodeCount: acc.nodeCount + rate.nodeCount,
    }
  }, {
    cost: 0,
    nodeCount: 0,
  });
  return {
    numberOfQueries: rates.length,
    remaining: rates.at(-1)?.remaining,
    ...tallied
  };
}
