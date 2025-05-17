const assert = require('assert');
const { calculateWinProbability } = require('../winprobcalc');

// Helper to approximate equality
function approxEqual(a, b, tolerance = 0.01) {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} not within ${tolerance} of ${b}`);
}

test('returns 50/50 for empty rounds', () => {
  const result = calculateWinProbability({ rounds: [] }, []);
  assert.strictEqual(result.us, 50);
  assert.strictEqual(result.dem, 50);
});

test('score difference affects probability', () => {
  const game = { rounds: [{ runningTotals: { us: 120, dem: 100 } }] };
  const result = calculateWinProbability(game, []);
  approxEqual(result.us, 50 + (20 / 15));
  approxEqual(result.dem, 100 - (50 + (20 / 15)));
});

test('momentum factor applies with recent rounds', () => {
  const rounds = [
    { usPoints: 20, demPoints: 10, runningTotals: { us: 20, dem: 10 } },
    { usPoints: 0, demPoints: 10, runningTotals: { us: 20, dem: 20 } },
    { usPoints: 15, demPoints: 5, runningTotals: { us: 35, dem: 25 } },
  ];
  const result = calculateWinProbability({ rounds }, []);
  approxEqual(result.us, 50 + (10 / 15) + 2);
});

test('bid strength factor favors team with more high bids', () => {
  const rounds = [
    { biddingTeam: 'us', bidAmount: 160, runningTotals: { us: 10, dem: 0 } },
    { biddingTeam: 'us', bidAmount: 160, runningTotals: { us: 20, dem: 0 } },
    { biddingTeam: 'dem', bidAmount: 150, runningTotals: { us: 20, dem: 10 } },
    { biddingTeam: 'dem', bidAmount: 130, runningTotals: { us: 20, dem: 20 } },
  ];
  const result = calculateWinProbability({ rounds }, []);
  approxEqual(result.us, 50 + 2);
});

test('comeback factor increases probability based on history', () => {
  const current = {
    rounds: [
      { runningTotals: { us: 10, dem: 20 } },
      { runningTotals: { us: 30, dem: 40 } },
      { runningTotals: { us: 50, dem: 60 } },
    ],
  };
  const history = [
    {
      rounds: [
        { runningTotals: { us: 10, dem: 20 } },
        { runningTotals: { us: 25, dem: 30 } },
        { runningTotals: { us: 40, dem: 45 } },
        { runningTotals: { us: 60, dem: 55 } },
      ],
      finalScore: { us: 80, dem: 75 },
    },
    {
      rounds: [
        { runningTotals: { us: 20, dem: 10 } },
        { runningTotals: { us: 40, dem: 25 } },
        { runningTotals: { us: 60, dem: 50 } },
        { runningTotals: { us: 60, dem: 90 } },
      ],
      finalScore: { us: 80, dem: 100 },
    },
  ];
  const result = calculateWinProbability(current, history);
  approxEqual(result.us, 50 + (-10 / 15) + 10);
});
