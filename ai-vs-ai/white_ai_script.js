// This script defines the logic for the AI player controlling the White pieces.
// It is designed to be included in the HTML before the main game script.

// We'll attach our AI object to the global 'window' object so the main script can access it.
window.WhiteAI = {
    // --- API Configuration ---
    // IMPORTANT: Storing API keys client-side is insecure. This is for development only.
    apiKey: "tgp_v1_abc5ACaW7FhDw1oIAd2waXa34RPicNpPNC8N6x203tw",
    apiUrl: "https://api.together.ai/v1/chat/completions",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    name: "Llama 3.3",

    /**
     * The main function to get a move from the AI.
     * @param {object} game - The current chess.js game instance.
     * @returns {Promise<string>} A promise that resolves with the AI's chosen move in SAN format.
     */
    getMove: async function(game) {
        const fen = game.fen();
        const pgn = game.pgn();
        const legalMoves = game.moves();

        const systemPrompt = "You are a world-class chess engine. You must follow the user's instructions precisely.";
        
        // --- CORRECTED: Use a different prompt for the first move vs. subsequent moves ---
        let userPrompt;
        if (game.history().length === 0) {
            // A simpler prompt for the opening move to prevent confusion.
            userPrompt = `It is White's turn to make the first move of the game. The legal opening moves are [${legalMoves.join(', ')}]. Analyze the best opening strategy (e.g., controlling the center). Provide a brief analysis, then on a final, separate line, write "Best Move:" followed by your single best opening move in Standard Algebraic Notation.`;
        } else {
            // The advanced 4-step thinking prompt for the rest of the game.
            userPrompt = `It is White's turn to move. Your thinking process must follow these four steps:
1.  Read the Game History (PGN) and the Current Position (FEN).
2.  Analyze the current position, considering material, king safety, and key threats for both sides.
3.  Based on Black's (the opponent's) moves in the PGN, analyze their likely strategy and predict their next 2-3 possible responses to your potential moves.
4.  State your chosen move.

Here is the game data:
- Game History (PGN): "${pgn}"
- Current Position (FEN): "${fen}"
- Legal Moves for White: [${legalMoves.join(', ')}]

Provide your analysis based on the four steps above. Then, on a final, separate line, write "Best Move:" followed by your single best move in Standard Algebraic Notation.`;
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0, 
                    max_tokens: 250 // Increased tokens to allow for thoughts
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            const fullResponse = result.choices[0].message.content.trim();
            
            // --- Parse the response to separate thoughts from the move ---
            const lines = fullResponse.split('\n');
            let aiMove = '';
            let thoughts = [];

            lines.forEach(line => {
                if (line.toLowerCase().startsWith('best move:')) {
                    aiMove = line.substring(10).trim();
                } else {
                    thoughts.push(line);
                }
            });

            // Log the AI's thoughts to the console
            if (thoughts.length > 0) {
                console.log(`--- ${this.name} is Thinking ---`);
                console.log(thoughts.join('\n'));
                console.log("--------------------------");
            }

            // If the AI didn't follow the format, try to find a move anyway
            if (!aiMove) {
                console.warn(`AI (${this.name}) did not use 'Best Move:' format. Taking last line as move.`);
                aiMove = lines[lines.length - 1].trim();
            }

            // Clean up the move in case it has extra characters
            return aiMove.replace(/\.$/, '');

        } catch (error) {
            console.error(`Error getting move from ${this.name}:`, error);
            // Re-throw the error so the main script can handle the retry logic
            throw error;
        }
    }
};
