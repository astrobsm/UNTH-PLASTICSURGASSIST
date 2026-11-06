declare module 'javascript-lp-solver' {
  const solver: { Solve(model: unknown): Record<string, any> & { feasible: boolean; result: number; bounded?: boolean } };
  export default solver;
}
