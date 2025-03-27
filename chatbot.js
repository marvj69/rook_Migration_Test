// chatbot.js

// --- Configuration ---
// IMPORTANT: Replace "YOUR_OPENAI_API_KEY" with your actual key
// OR ideally, use a secure method like a backend proxy.
// DO NOT COMMIT YOUR REAL KEY TO VERSION CONTROL.
const OPENAI_API_URL = "/.netlify/functions/openai-proxy"; // <<< NEW URL
const OPENAI_MODEL = "gpt-4o-mini"; // Use the specified model

// Note: PRO_MODE_KEY is defined in the main script as "proModeEnabled"

// --- State ---
let chatMessages = [];
let isChatOpen = false;
let chatbotContainer = null;
let chatBody = null;
let messageInput = null;
let isBotTyping = false;

// --- UI Elements ---
function createChatbotUI() {
    const container = document.createElement('div');
    container.id = 'rook-chatbot-container';
    container.className = 'fixed bottom-4 right-4 z-[9000]'; // High z-index

    // Chat bubble toggle button
    container.innerHTML = `
        <button id="chatbot-toggle" class="bg-primary text-white rounded-full p-3 shadow-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-transform transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        </button>

        <!-- Chat Window (Initially Hidden) -->
        <div id="chatbot-window" class="hidden absolute bottom-16 right-0 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col" style="height: 450px;">
            <!-- Header -->
            <div class="bg-gray-100 dark:bg-gray-900 p-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
                <h3 class="text-md font-semibold text-gray-800 dark:text-white">Rook Assistant</h3>
                <div class="flex items-center space-x-2">
                    <button id="chatbot-clear" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" title="Clear chat">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                    <button id="chatbot-close" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Chat Body -->
            <div id="chatbot-body" class="flex-1 overflow-y-auto p-4 space-y-3">
                <!-- Messages will appear here -->
                <div class="chatbot-message bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded-lg text-sm max-w-[85%] self-start">
                    Hi! I'm the Rook Assistant. Ask me how to use the app or about game stats.
                </div>
            </div>

            <!-- Typing Indicator -->
             <div id="chatbot-typing-indicator" class="px-4 pb-1 text-sm text-gray-500 dark:text-gray-400 hidden">
                <span>Assistant is typing</span><span class="typing-dots">...</span>
            </div>

            <!-- Input Area -->
            <div class="p-3 border-t border-gray-200 dark:border-gray-700">
                <form id="chatbot-form" class="flex space-x-2">
                    <input type="text" id="chatbot-input" placeholder="Ask something..." class="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400" required>
                    <button type="submit" class="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 dark:focus:ring-blue-400">
                        Send
                    </button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    chatbotContainer = container; // Store reference
    chatBody = document.getElementById('chatbot-body');
    messageInput = document.getElementById('chatbot-input');

    // Add the welcome message to the chat history array
    chatMessages.push({ 
        sender: 'bot', 
        text: "Hi! I'm the Rook Assistant. Ask me how to use the app or about game stats." 
    });

    // Add Event Listeners
    document.getElementById('chatbot-toggle').addEventListener('click', toggleChatWindow);
    document.getElementById('chatbot-close').addEventListener('click', toggleChatWindow);
    document.getElementById('chatbot-clear').addEventListener('click', clearChat);
    document.getElementById('chatbot-form').addEventListener('submit', handleSendMessage);
}

// --- Function to clear chat ---
function clearChat() {
    if (!chatBody) return;
    
    // Find all messages
    const allMessages = chatBody.querySelectorAll('.chatbot-message');
    const welcomeMessage = Array.from(allMessages).find(msg => 
        msg.textContent === "Hi! I'm the Rook Assistant. Ask me how to use the app or about game stats.");
    
    // Clear all messages except the welcome message
    chatBody.innerHTML = '';
    
    // If the welcome message was found, add it back
    if (welcomeMessage) {
        chatBody.appendChild(welcomeMessage);
    } else {
        // If not found for some reason, recreate it
        const newWelcomeMessage = document.createElement('div');
        newWelcomeMessage.className = 'chatbot-message bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded-lg text-sm max-w-[85%] self-start';
        newWelcomeMessage.textContent = "Hi! I'm the Rook Assistant. Ask me how to use the app or about game stats.";
        chatBody.appendChild(newWelcomeMessage);
    }
    
    // Reset chat messages array but keep welcome message
    chatMessages = [{ 
        sender: 'bot', 
        text: "Hi! I'm the Rook Assistant. Ask me how to use the app or about game stats." 
    }];
    
    // Focus on input after clearing
    messageInput?.focus();
    
    console.log("Chat cleared");
}

function toggleChatWindow() {
    const windowEl = document.getElementById('chatbot-window');
    isChatOpen = !isChatOpen;
    windowEl.classList.toggle('hidden', !isChatOpen);
    if (isChatOpen) {
        messageInput?.focus();
        chatBody.scrollTop = chatBody.scrollHeight; // Scroll to bottom on open
    }
}

function addMessageToChat(sender, message) {
    if (!chatBody) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message p-2 rounded-lg text-sm max-w-[85%] break-words ${
        sender === 'user'
            ? 'bg-blue-500 dark:bg-blue-600 text-white self-end'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white self-start'
    }`;
    // Basic sanitation - replace potential HTML tags
    messageDiv.textContent = message.replace(/</g, "<").replace(/>/g, ">");

    chatBody.appendChild(messageDiv);
    // Scroll to the bottom to show the new message
    chatBody.scrollTop = chatBody.scrollHeight;
}

function setTypingIndicator(isTyping) {
    const indicator = document.getElementById('chatbot-typing-indicator');
    if (indicator) {
        indicator.classList.toggle('hidden', !isTyping);
        isBotTyping = isTyping;
         if (isTyping) {
             chatBody.scrollTop = chatBody.scrollHeight; // Scroll down when typing starts
         }
    }
}

// --- Context Gathering ---
function getAppContext() {
    let context = "App Context:\n";

    // Try to get current game data if available
    try {
        const currentGameStateRaw = localStorage.getItem("activeGameState");
        if (currentGameStateRaw) {
            try {
                const current = JSON.parse(currentGameStateRaw);
                if (current && current.rounds && current.rounds.length > 0) {
                    context += `- Current Game: Round ${current.rounds.length + 1}. `;
                    
                    if (current.rounds.length > 0) {
                        const lastRound = current.rounds[current.rounds.length - 1];
                        context += `Last Round Totals: Us ${lastRound.runningTotals.us}, Dem ${lastRound.runningTotals.dem}. `;
                        
                        // Add detailed information about the last round
                        context += `Last Round: Team "${lastRound.biddingTeam}" bid ${lastRound.bidAmount}. `;
                        context += `Points scored: Us ${lastRound.usPoints}, Dem ${lastRound.demPoints}. `;
                        
                        // Add information about all previous rounds
                        if (current.rounds.length > 1) {
                            context += `\n  - Previous Rounds Summary: `;
                            for (let i = 0; i < current.rounds.length - 1; i++) {
                                const round = current.rounds[i];
                                context += `Round ${i+1}: ${round.biddingTeam} bid ${round.bidAmount}, scored Us ${round.usPoints}/Dem ${round.demPoints}. `;
                            }
                        }
                    } else {
                        context += `Started, Round 1. No scores yet. `;
                    }
                    
                    // Current game phase
                    if (current.biddingTeam) {
                        context += `\n  - Current bid phase for ${current.biddingTeam}. `;
                        if (current.bidAmount) {
                            context += `Current bid: ${current.bidAmount}. `;
                        }
                    }
                    
                    // Team names
                    if (current.usTeamName) {
                        context += `\n  - Team names: ${current.usTeamName} (Us) vs ${current.demTeamName} (Dem). `;
                    }
                    
                    // Game progress
                    const highestScore = Math.max(current.rounds.length > 0 ? 
                        current.rounds[current.rounds.length - 1].runningTotals.us : 0, 
                        current.rounds.length > 0 ? 
                        current.rounds[current.rounds.length - 1].runningTotals.dem : 0);
                    context += `\n  - Game progress: ${highestScore}/500 points (${Math.floor((highestScore/500)*100)}% complete). `;
                    
                    context += `\n`;
                } else {
                    context += `- Current Game: No active game or no rounds played yet.\n`;
                }
            } catch (e) {
                // Ignore errors
            }
        } else {
            context += "- Current Game: No active game found.\n";
        }

        // Saved Games (More Detailed)
        const savedGamesRaw = localStorage.getItem("savedGames");
        if (savedGamesRaw) {
            const saved = JSON.parse(savedGamesRaw);
            context += `- Completed Games: ${saved.length} found.\n`;
            
            // Show more details about recent games
            if (saved.length > 0) {
                // Get the most recent 3 games or fewer if less exist
                const recentGames = saved.slice(-Math.min(3, saved.length));
                context += `  - Recent Completed Games:\n`;
                
                recentGames.forEach((game, index) => {
                    const gameDate = new Date(game.timestamp).toLocaleDateString();
                    context += `    - Game ${saved.length - (recentGames.length - 1 - index)}: ${game.usTeamName || 'Us'} (${game.finalScore?.us}) vs ${game.demTeamName || 'Dem'} (${game.finalScore?.dem}). `;
                    context += `Winner: ${game.winner === 'us' ? (game.usTeamName || 'Us') : (game.demTeamName || 'Dem')}. `;
                    context += `Date: ${gameDate}. `;
                    if (game.durationMs) {
                        const durationMin = Math.floor(game.durationMs / 60000);
                        context += `Duration: ${durationMin} minutes. `;
                    }
                    context += `Rounds: ${game.rounds?.length || 0}.\n`;
                });
            }
        } else {
            context += "- Completed Games: None found.\n";
        }

        // Freezer Games (More Detailed)
        const freezerGamesRaw = localStorage.getItem("freezerGames");
        if (freezerGamesRaw) {
            const frozen = JSON.parse(freezerGamesRaw);
            context += `- Frozen Games: ${frozen.length} found.\n`;
            
            if (frozen.length > 0) {
                // Get the most recent 3 frozen games or fewer if less exist
                const recentFrozen = frozen.slice(-Math.min(3, frozen.length));
                context += `  - Recent Frozen Games:\n`;
                
                recentFrozen.forEach((game, index) => {
                    const gameDate = new Date(game.timestamp).toLocaleDateString();
                    context += `    - Game ${frozen.length - (recentFrozen.length - 1 - index)}: ${game.usTeamName || game.usName || 'Us'} (${game.finalScore?.us || 0}) vs ${game.demTeamName || game.demName || 'Dem'} (${game.finalScore?.dem || 0}). `;
                    context += `Date: ${gameDate}. `;
                    context += `Rounds: ${game.rounds?.length || 0}.\n`;
                });
            }
        } else {
            context += "- Frozen Games: None found.\n";
        }

        // Statistics
        const statsRaw = localStorage.getItem("gameStatistics");
        if (statsRaw) {
            const stats = JSON.parse(statsRaw);
            context += `- Overall Statistics:\n`;
            if (stats.totalGames) {
                context += `  - Total Games: ${stats.totalGames}\n`;
                context += `  - Average Score: ${stats.avgScore?.toFixed(1) || 'N/A'}\n`;
                context += `  - Average Winning Score: ${stats.avgWinningScore?.toFixed(1) || 'N/A'}\n`;
                context += `  - Average Bid: ${stats.avgBid?.toFixed(1) || 'N/A'}\n`;
                context += `  - Average Game Time: ${stats.avgGameTime ? Math.floor(stats.avgGameTime / 60000) + ' minutes' : 'N/A'}\n`;
            }
            
            // Team specific stats if available
            if (stats.teamStats && Object.keys(stats.teamStats).length > 0) {
                context += `  - Team Statistics Available for: ${Object.keys(stats.teamStats).join(', ')}\n`;
            }
        } else {
            context += "- Statistics: None available.\n";
        }

        // Pro Mode Status
        const isPro = JSON.parse(localStorage.getItem("proModeEnabled") || "false");
        context += `- Pro Mode: ${isPro ? 'Enabled' : 'Disabled'}.\n`;
        
        // Add Preset Bid Information
        const presetBidsRaw = localStorage.getItem('customPresetBids');
        if (presetBidsRaw) {
            const presets = JSON.parse(presetBidsRaw);
            context += `- Bid Presets: ${presets.filter(b => b !== "other").join(', ')}.\n`;
        } else {
            // Default presets if not customized
            context += `- Bid Presets: Default values (120, 125, 130, 135, 140, 145).\n`;
        }
        
        // Game settings
        context += "- Game Settings:\n";
        const mustWinByBid = JSON.parse(localStorage.getItem("rookMustWinByBid") || "false");
        context += `  - 'Must Win By Bid' Rule: ${mustWinByBid ? 'Enabled' : 'Disabled'}.\n`;
        
        // Theme settings
        const darkMode = JSON.parse(localStorage.getItem("darkMode") || "false");
        context += `  - Theme: ${darkMode ? 'Dark' : 'Light'} mode.\n`;
        
        // User preferences if available
        const userPrefs = localStorage.getItem("userPreferences");
        if (userPrefs) {
            try {
                const prefs = JSON.parse(userPrefs);
                context += `  - User Preferences: ${Object.keys(prefs).map(k => `${k}: ${prefs[k]}`).join(', ')}.\n`;
            } catch (e) {
                // Ignore parsing errors
            }
        }
        
        // Sync status
        const isLoggedIn = localStorage.getItem("googleUserProfile") !== null;
        context += `  - Cloud Sync: ${isLoggedIn ? 'Enabled (user logged in)' : 'Disabled (not logged in)'}.\n`;

    } catch (error) {
        console.error("Error gathering app context:", error);
        context += "- Error retrieving some game data from local storage.\n";
    }
    return context;
}

// Get detailed team statistics for specified teams
function getTeamStats(teamNames) {
  let teamStats = {};
  try {
    const statsRaw = localStorage.getItem("gameStatistics");
    if (!statsRaw) return null;
    
    const stats = JSON.parse(statsRaw);
    if (!stats.teamStats) return null;
    
    // If specific team names provided, only get those
    if (teamNames && Array.isArray(teamNames)) {
      teamNames.forEach(name => {
        if (stats.teamStats[name]) {
          teamStats[name] = stats.teamStats[name];
        }
      });
    } else {
      // Otherwise get all team stats
      teamStats = stats.teamStats;
    }
    
    return Object.keys(teamStats).length > 0 ? teamStats : null;
  } catch (error) {
    console.error("Error getting team statistics:", error);
    return null;
  }
}

// Analyze the current game and provide insights
function getCurrentGameInsights() {
  let insights = "";
  try {
    const currentGameStateRaw = localStorage.getItem("activeGameState");
    if (!currentGameStateRaw) return insights;
    
    const game = JSON.parse(currentGameStateRaw);
    if (!game || !game.rounds || game.rounds.length === 0) return insights;
    
    insights = "Current Game Insights:\n";
    
    // Analyze bidding patterns
    const bids = {
      us: {
        count: 0,
        totalBidAmount: 0,
        successfulBids: 0,
        totalPoints: 0
      },
      dem: {
        count: 0,
        totalBidAmount: 0,
        successfulBids: 0,
        totalPoints: 0
      }
    };
    
    // Analyze round data
    game.rounds.forEach(round => {
      const team = round.biddingTeam;
      bids[team].count++;
      bids[team].totalBidAmount += round.bidAmount;
      
      const pointsMade = team === 'us' ? round.usPoints : round.demPoints;
      bids[team].totalPoints += pointsMade;
      
      // Check if bid was successful
      if (pointsMade >= round.bidAmount) {
        bids[team].successfulBids++;
      }
    });
    
    // Generate bidding insights
    if (game.rounds.length > 0) {
      insights += "- Bidding Patterns:\n";
      
      ['us', 'dem'].forEach(team => {
        if (bids[team].count > 0) {
          const teamName = team === 'us' ? (game.usTeamName || "Us") : (game.demTeamName || "Dem");
          const avgBid = bids[team].totalBidAmount / bids[team].count;
          const successRate = (bids[team].successfulBids / bids[team].count) * 100;
          
          insights += `  - ${teamName}: ${bids[team].count} bids, avg bid ${avgBid.toFixed(1)}, success rate ${successRate.toFixed(1)}%\n`;
        }
      });
    }
    
    // Score trend analysis
    if (game.rounds.length > 1) {
      insights += "- Score Trends:\n";
      
      // Calculate point momentum (last 3 rounds)
      const recentRounds = game.rounds.slice(-Math.min(3, game.rounds.length));
      let usPointsChange = 0;
      let demPointsChange = 0;
      
      for (let i = 1; i < recentRounds.length; i++) {
        usPointsChange += recentRounds[i].usPoints - recentRounds[i-1].usPoints;
        demPointsChange += recentRounds[i].demPoints - recentRounds[i-1].demPoints;
      }
      
      const usAvgChange = usPointsChange / (recentRounds.length - 1);
      const demAvgChange = demPointsChange / (recentRounds.length - 1);
      
      if (usAvgChange > 0 || demAvgChange > 0) {
        insights += `  - Point momentum: ${game.usTeamName || "Us"} ${usAvgChange > 0 ? "gaining" : "losing"} ${Math.abs(usAvgChange).toFixed(1)} pts/round, ${game.demTeamName || "Dem"} ${demAvgChange > 0 ? "gaining" : "losing"} ${Math.abs(demAvgChange).toFixed(1)} pts/round\n`;
      }
      
      // Determine closest to winning
      const lastRound = game.rounds[game.rounds.length - 1];
      const usToWin = 500 - lastRound.runningTotals.us;
      const demToWin = 500 - lastRound.runningTotals.dem;
      
      insights += `  - Points to 500: ${game.usTeamName || "Us"} needs ${usToWin > 0 ? usToWin : 0}, ${game.demTeamName || "Dem"} needs ${demToWin > 0 ? demToWin : 0}\n`;
    }
    
    // Win probability based on current score (if in Pro Mode)
    const isPro = JSON.parse(localStorage.getItem("proModeEnabled") || "false");
    if (isPro && game.rounds.length > 0) {
      const lastRound = game.rounds[game.rounds.length - 1];
      const usScore = lastRound.runningTotals.us;
      const demScore = lastRound.runningTotals.dem;
      
      // Simple win probability calculation
      // This is just an example - you may have a more complex algorithm in your actual app
      const totalPossible = 500;
      const usProbability = Math.min(95, Math.max(5, Math.round((usScore / (usScore + demScore)) * 100)));
      const demProbability = 100 - usProbability;
      
      insights += "- Win Probability (simplified):\n";
      insights += `  - ${game.usTeamName || "Us"}: ${usProbability}%, ${game.demTeamName || "Dem"}: ${demProbability}%\n`;
    }
    
    return insights;
  } catch (error) {
    console.error("Error generating game insights:", error);
    return "";
  }
}

// --- OpenAI API Call (Modified for Netlify Function) ---
async function fetchOpenAIResponse(userMessage) {
  // NOTE: The OPENAI_API_KEY is NO LONGER needed here.
  // It's handled securely by the Netlify function.

  // Check for internet connection (remains the same)
  if (!navigator.onLine) {
      addMessageToChat('bot', "I'm currently offline. I'll be available when you reconnect to the internet.");
      setTypingIndicator(false);
      return;
  }

  setTypingIndicator(true);

  // Fetch updated context each time a new message is sent (remains the same)
  const currentContext = getAppContext();

  // Get current game team names if available (remains the same)
  let currentTeamNames = [];
  try {
      const currentGameStateRaw = localStorage.getItem("activeGameState");
      if (currentGameStateRaw) {
          const current = JSON.parse(currentGameStateRaw);
          if (current && current.usTeamName && current.demTeamName) { // Ensure both names exist
              currentTeamNames.push(current.usTeamName, current.demTeamName);
          }
      }
  } catch (e) {
      // Ignore errors
  }

  // Get statistics for current teams if available (remains the same)
  let teamStatsContext = "";
  // Only get stats if we actually have team names for the current game
  if (currentTeamNames.length === 2) {
      const currentTeamStats = getTeamStats(currentTeamNames);
      if (currentTeamStats) {
          teamStatsContext = "Current Teams Detailed Statistics:\n";
          Object.entries(currentTeamStats).forEach(([teamName, stats]) => {
              teamStatsContext += `- ${teamName}:\n`;
              teamStatsContext += `  - Games Played: ${stats.gamesPlayed || 0}\n`;
              const winRate = (stats.gamesPlayed && stats.wins) ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) : '0.0';
              teamStatsContext += `  - Wins: ${stats.wins || 0} (${winRate}%)\n`;
              teamStatsContext += `  - Avg Score: ${stats.avgScore?.toFixed(1) || 'N/A'}\n`;
              teamStatsContext += `  - Avg Bid: ${stats.avgBid?.toFixed(1) || 'N/A'}\n`;
              const bidSuccessRate = (stats.totalBids && stats.successfulBids) ? ((stats.successfulBids / stats.totalBids) * 100).toFixed(1) : '0.0';
              teamStatsContext += `  - Bid Success Rate: ${bidSuccessRate}%\n`;
              if (stats.avgPointsPerRound) teamStatsContext += `  - Avg Points Per Round: ${stats.avgPointsPerRound.toFixed(1)}\n`;
              if (stats.highestBid) teamStatsContext += `  - Highest Bid: ${stats.highestBid}\n`;
              if (stats.highestScore) teamStatsContext += `  - Highest Score: ${stats.highestScore}\n`;
          });
      }
  }


  // Get current game insights (remains the same)
  const gameInsights = getCurrentGameInsights();

  // Check if the user message is asking about team stats (remains the same)
  const isAskingAboutTeams = userMessage.toLowerCase().includes("team") &&
                             (userMessage.toLowerCase().includes("stat") ||
                              userMessage.toLowerCase().includes("performance") ||
                              userMessage.toLowerCase().includes("winning") ||
                              userMessage.toLowerCase().includes("record"));

  // Check if the user is asking about the current game or analysis (remains the same)
  const isAskingAboutGame = userMessage.toLowerCase().includes("game") ||
                            userMessage.toLowerCase().includes("current") ||
                            userMessage.toLowerCase().includes("score") ||
                            userMessage.toLowerCase().includes("winning") ||
                            userMessage.toLowerCase().includes("analysis") ||
                            userMessage.toLowerCase().includes("trend") ||
                            userMessage.toLowerCase().includes("prediction");

  // Construct the system prompt (remains the same logic)
  const systemPrompt = `You are a helpful assistant for a web application designed for scoring the card game Rook.
Your goal is to help users understand how to use the app and answer questions about game data.

App Functionality Overview:
- Core scoring: Tap a team ('Us' or 'Dem') to start bidding. Enter bid amount (presets or custom). Choose to enter points for Bidding or Non-Bidding team. Submit points (0-180, or 360). Scores update, history shown. Game ends at 500+ points (unless 'Must Win By Bid' is enabled, then bidder must make bid if score reaches 500+) or 1000 point spread.
- History: Shows running totals and bid details per round.
- Menu (Hamburger Icon):
  - View Games: Shows completed and frozen games. Can view details, load frozen games, or delete games.
  - New Game: Starts a fresh game (asks for confirmation).
  - Freeze Game: Saves the current game's progress to the "Freezer" list and resets the main screen.
  - Settings: Access 'Must Win By Bid' rule toggle, Pro Mode toggle, Theme selection, Edit Bid Presets (if Pro Mode enabled).
  - About: Shows app instructions and version info.
  - Statistics: Shows overall and team-specific stats (win %, avg bid, etc.) based on completed games. Requires team names to be set for team stats.
  - Dark Mode: Toggles dark/light theme.
  - Sign in with Google: Syncs game data (current, saved, frozen, stats, settings) to the cloud.
- Pro Mode: When enabled, shows win probability percentages on team cards during a game and allows editing bid preset buttons via Settings. This chatbot is only visible in Pro Mode.
- Team Names: Can be set via the 'Select Teams' button that appears when saving or freezing a game without names, or potentially via Statistics if implemented. Stats are tracked per unique team name.

Game Data Structure (Simplified):
- Games have rounds. Each round has: biddingTeam ('us'/'dem'), bidAmount, usPoints, demPoints, runningTotals {us, dem}.
- Saved/Frozen games have: finalScore {us, dem}, rounds list, timestamp, usTeamName, demTeamName, winner ('us'/'dem'/null), durationMs (completed only).

Your Capabilities:
- Explain how to perform actions in the app (e.g., "How do I start a new round?", "How do I save a game?").
- Answer questions based on the provided game context (e.g., "What's the current score?", "Who won the last completed game?").
- Summarize game data (e.g., "How many games are frozen?").
- Analyze patterns in game data to provide meaningful insights.
- Calculate statistics and trends based on current game state.
- Explain rules of the Rook card game if asked.

Limitations:
- You CANNOT perform actions in the app (e.g., you cannot start a new game or submit scores for the user). Instruct the user on how to do it themselves.
- Your knowledge of game data is based on the snapshot provided below. It's not real-time unless the user asks a question again.
- Avoid making up information if it's not in the context. Say "I don't have that specific information" or "I can only see summary data".
- Keep answers concise and relevant to the Rook scoring app.

Current App Context Snapshot:
${currentContext}
${isAskingAboutTeams && teamStatsContext ? teamStatsContext : ""}
${isAskingAboutGame && gameInsights ? gameInsights : ""}
`;

  // Prepare messages for the Netlify function (remains the same logic)
  const apiMessages = [
      { role: "system", content: systemPrompt },
      // Include recent chat history
      ...chatMessages.slice(-8).map(msg => ({
           role: msg.sender === 'user' ? 'user' : 'assistant',
           content: msg.text
       })),
      { role: "user", content: userMessage }
  ];

  // --- MODIFIED FETCH CALL ---
  try {
      // Fetch FROM YOUR NETLIFY FUNCTION, not directly from OpenAI
      const response = await fetch(OPENAI_API_URL, { // Uses the updated URL '/.netlify/functions/openai-proxy'
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              // NO 'Authorization' header here!
              // The Netlify function adds the API key securely on the server.
          },
          body: JSON.stringify({
              // Send the data the Netlify function expects
              model: OPENAI_MODEL,     // Send the desired model
              messages: apiMessages    // Send the conversation messages
              // The Netlify function will handle max_tokens, temperature etc.
              // unless you specifically designed it to accept them here.
          })
      });

      // Handle the response FROM YOUR NETLIFY FUNCTION
      if (!response.ok) {
          // Attempt to parse error details sent back from the function or OpenAI
          let errorMsg = `Assistant Error ${response.status}`;
          try {
              const errorData = await response.json();
              // Use the specific error message if available, otherwise stringify
              errorMsg = errorData.error?.message || errorData.error || JSON.stringify(errorData);
              console.error("Error response from Netlify function:", errorData);
          } catch (e) {
              // If parsing fails, use the status text
              errorMsg = `${errorMsg}: ${response.statusText}`;
              console.error("Could not parse error response from Netlify function. Status:", response.status);
          }
           // Throw an error to be caught by the catch block
          throw new Error(errorMsg);
      }

      // If response is OK, parse the JSON data (which is the OpenAI response forwarded by the function)
      const data = await response.json();
      const botReply = data.choices?.[0]?.message?.content?.trim();

      if (botReply) {
          addMessageToChat('bot', botReply);
          // Add bot reply to history
           chatMessages.push({ sender: 'bot', text: botReply });
      } else {
          console.warn("Received OK response but no valid message content:", data);
          addMessageToChat('bot', "Sorry, I received an empty response.");
      }

  } catch (error) {
      // Handle errors during the fetch or from the function/OpenAI
      console.error("Error fetching response via Netlify function:", error);
      // Display a user-friendly error message
      addMessageToChat('bot', `Sorry, I encountered an issue. Please try again later. (${error.message})`);
      // You might want a less technical message for the user:
      // addMessageToChat('bot', `Sorry, I'm having trouble connecting right now. Please try again later.`);
  } finally {
      // Always turn off the typing indicator
       setTypingIndicator(false);
  }
}

// --- Event Handlers ---
function handleSendMessage(event) {
    event.preventDefault();
    if (!messageInput || isBotTyping) return;

    const userMessage = messageInput.value.trim();
    if (userMessage) {
        addMessageToChat('user', userMessage);
        // Add user message to history
        chatMessages.push({ sender: 'user', text: userMessage });

        messageInput.value = ''; // Clear input
        fetchOpenAIResponse(userMessage); // Get bot response
    }
}

// --- Initialization and Visibility Control ---
function initChatbot() {
    // Check if Pro Mode is enabled on initial load
    const isProModeEnabled = JSON.parse(localStorage.getItem(PRO_MODE_KEY) || "false");

    if (isProModeEnabled) {
        if (!document.getElementById('rook-chatbot-container')) {
            createChatbotUI();
        }
        chatbotContainer?.classList.remove('hidden');
    } else {
         // Ensure it's hidden or not created if Pro Mode is off
         chatbotContainer?.classList.add('hidden');
         if (isChatOpen) { // Close chat window if Pro mode is turned off
             toggleChatWindow();
         }
    }
}

// Public function to be called from the main script when Pro Mode changes
window.updateChatbotVisibility = function(isProModeEnabled) {
    console.log("Updating chatbot visibility based on Pro Mode:", isProModeEnabled);
    if (isProModeEnabled) {
        if (!chatbotContainer) { // If UI doesn't exist yet, create it
            createChatbotUI();
        } else { // If it exists, just ensure it's visible
             chatbotContainer.classList.remove('hidden');
        }
    } else {
        if (chatbotContainer) {
            chatbotContainer.classList.add('hidden');
             if (isChatOpen) { // Close chat window if Pro mode is turned off
                 toggleChatWindow();
             }
        }
    }
};

// --- Run ---
// Wait for the main DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', initChatbot);