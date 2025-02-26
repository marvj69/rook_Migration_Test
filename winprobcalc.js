function renderWinProbability() {
  const { rounds, usTeamName, demTeamName, gameOver } = state;
  if (rounds.length === 0 || gameOver) return "";
  const historicalGames = getLocalStorage("savedGames");
  const winProb = calculateWinProbability(state, historicalGames);
  const labelUs = usTeamName || "Us";
  const labelDem = demTeamName || "Dem";
  return `
    <div id="winProbabilityDisplay" class="text-center text-sm text-gray-600 dark:text-gray-300">
      <span class="inline-block px-4">${labelUs}: ${winProb.us.toFixed(1)}%</span>
      <span class="inline-block px-4">${labelDem}: ${winProb.dem.toFixed(1)}%</span>
    </div>
  `;
}

/**
 * Calculate win probability based on current scores and historical data
 * @param {Object} currentGame - Current game state
 * @param {Array} historicalGames - Previously saved games
 * @returns {Object} Win probabilities for both teams
 */
function calculateWinProbability(currentGame, historicalGames) {
  const { rounds, usTeamName, demTeamName } = currentGame;
  
  if (!rounds || rounds.length === 0) {
    return { us: 50, dem: 50, factors: [] };
  }
  
  // Get current scores
  const lastRound = rounds[rounds.length - 1];
  const currentScores = lastRound.runningTotals || { us: 0, dem: 0 };
  const scoreDiff = currentScores.us - currentScores.dem;
  const roundsPlayed = rounds.length;
  
  // Base probability calculation from score difference
  let baseProb = 50 + (scoreDiff / 20);  // Each 20 points is worth 1% advantage
  
  // Adjust for tendency to come back from behind
  let comebackFactor = 0;
  
  // Find similar historical games
  const relevantGames = historicalGames.filter(game => {
    // Games with same teams or enough rounds played
    return (game.usTeamName === usTeamName && game.demTeamName === demTeamName) || 
           (game.rounds && game.rounds.length >= roundsPlayed);
  });
  
  // Analyze comebacks in historical games
  if (relevantGames.length > 0) {
    let comebackCount = 0;
    let totalSimilarSituations = 0;
    
    relevantGames.forEach(game => {
      if (!game.rounds || game.rounds.length <= roundsPlayed) return;
      
      // Get the score at the same round number as current game
      const historicalRound = game.rounds[roundsPlayed - 1];
      const laterRound = game.rounds[game.rounds.length - 1];
      
      if (!historicalRound || !laterRound) return;
      
      const historicalScores = historicalRound.runningTotals;
      const finalScores = laterRound.runningTotals;
      
      if (!historicalScores || !finalScores) return;
      
      const historicalLeader = historicalScores.us > historicalScores.dem ? "us" : "dem";
      const finalWinner = finalScores.us > finalScores.dem ? "us" : "dem";
      
      // If the leader changed, count as comeback
      if (historicalLeader !== finalWinner) {
        comebackCount++;
      }
      
      totalSimilarSituations++;
    });
    
    // Calculate comeback adjustment factor
    if (totalSimilarSituations > 0) {
      const comebackRate = comebackCount / totalSimilarSituations;
      comebackFactor = Math.round(comebackRate * 10); // Max 10% adjustment
    }
  }
  
  // Momentum factor - has one team been winning more recent rounds?
  let momentumFactor = 0;
  if (rounds.length >= 3) {
    let recentUsPoints = 0;
    let recentDemPoints = 0;
    
    // Look at last 3 rounds for momentum
    for (let i = rounds.length - 3; i < rounds.length; i++) {
      if (i >= 0) {
        recentUsPoints += rounds[i].usPoints || 0;
        recentDemPoints += rounds[i].demPoints || 0;
      }
    }
    
    if (recentUsPoints > recentDemPoints) {
      momentumFactor = 5; // 5% boost for Us
    } else if (recentDemPoints > recentUsPoints) {
      momentumFactor = -5; // 5% boost for Dem
    }
  }
  
  // Bid strength factor
  let bidStrengthFactor = 0;
  const usHighBids = rounds.filter(r => r.biddingTeam === "us" && r.bidAmount >= 145).length;
  const demHighBids = rounds.filter(r => r.biddingTeam === "dem" && r.bidAmount >= 145).length;
  
  if (usHighBids > demHighBids) {
    bidStrengthFactor = 3; // 3% advantage to team taking stronger bids
  } else if (demHighBids > usHighBids) {
    bidStrengthFactor = -3;
  }
  
  // Calculate final probability
  const adjustedProb = Math.min(Math.max(baseProb + momentumFactor + comebackFactor + bidStrengthFactor, 1), 99);
  
  // Factors that influenced the calculation (for explanation)
  const factors = [
    { name: "Score Difference", value: Math.round((scoreDiff / 20)), description: `${Math.abs(scoreDiff)} point difference` },
    { name: "Momentum", value: momentumFactor, description: momentumFactor !== 0 ? `Recent rounds trend` : "No clear momentum" },
    { name: "Comeback Tendency", value: comebackFactor, description: `Based on ${relevantGames.length} similar games` },
    { name: "Bid Strength", value: bidStrengthFactor, description: `High bids: ${usTeamName} (${usHighBids}), ${demTeamName} (${demHighBids})` }
  ];
  
  return {
    us: adjustedProb,
    dem: 100 - adjustedProb,
    factors: factors
  };
}