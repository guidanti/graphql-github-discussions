import {
  Channel,
  createChannel,
  createContext,
  Operation,
  resource,
} from "npm:effection@3.0.3";

interface CostEntries {
  cost: number;
  remaining: number;
  nodeCount: number;
}

export const CostContext = createContext<Channel<CostEntries, void>>(
  "cost",
);

export function createCost() {
  return resource<Channel<CostEntries, void>>(
    function* (provide) {
      const channel = createChannel<CostEntries>();

      try {
        yield* provide(channel);
      } finally {
        yield* channel.close();
      }
    },
  );
}

export function* initCostContext(): Operation<
  Channel<CostEntries, void>
> {
  const cost = yield* createCost();
  return yield* CostContext.set(cost);
}

export function* useCost(): Operation<Channel<CostEntries, void>> {
  return yield* CostContext;
}
