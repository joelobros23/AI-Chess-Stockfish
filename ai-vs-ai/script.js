$(document).ready(function() {
    // --- Global Variables ---
    let board = null;
    const game = new Chess();
    let isGameRunning = false;

    // --- DOM Elements ---
    const statusEl = $('#status');
    const pgnEl = $('#pgn');
    const capturedByBlackEl = $('#captured-by-black');
    const capturedByWhiteEl = $('#captured-by-white');
    const overlayEl = $('#game-overlay');
    const aiStatusEl = $('#ai-status');

    // --- Piece Tracking ---
    let whiteCaptured = [];
    let blackCaptured = [];
    const pieceSymbols = { 'wP': '♙', 'wN': '♘', 'wB': '♗', 'wR': '♖', 'wQ': '♕', 'wK': '♔', 'bP': '♟', 'bN': '♞', 'bB': '♝', 'bR': '♜', 'bQ': '♛', 'bK': '♚' };

    // ===================================================================
    //  AI vs AI GAME LOGIC
    // ===================================================================

    /**
     * This is the main game loop that calls the correct AI based on the turn.
     */
    async function playNextTurn() {
        if (!isGameRunning || game.game_over()) {
            isGameRunning = false;
            aiStatusEl.hide();
            return;
        }

        const turn = game.turn();
        // Use the globally defined WhiteAI object or the locally defined BlackAI
        const aiPlayer = (turn === 'w') ? window.WhiteAI : BlackAI;
        
        aiStatusEl.html(`<div class="spinner"></div> ${aiPlayer.name} is thinking...`);
        aiStatusEl.css('display', 'flex');

        try {
            // The getMove function for both AIs now returns just the final move string.
            // The thinking is logged to the console inside the getMove function itself.
            const move = await aiPlayer.getMove(game);
            const moveResult = game.move(move, { sloppy: true });

            if (moveResult === null) {
                throw new Error(`AI (${aiPlayer.name}) suggested an invalid move: ${move}`);
            }

            // Success, update board and queue next turn
            board.position(game.fen());
            updateGameInfo(moveResult);
            setTimeout(playNextTurn, 1000); // Wait 1 second before the next turn

        } catch (error) {
            console.error(`Error during ${aiPlayer.name}'s turn. Retrying...`, error);
            setTimeout(playNextTurn, 2000); // Wait 2 seconds and retry on error
        }
    }

    /**
     * This object defines the AI that plays as Black (Gemini)
     * CORRECTED: Restored the advanced thinking and console logging functionality.
     */
    const BlackAI = {
        name: "Gemini",
        apiKey: "AIzaSyDaNS63l9P-ASSZ3ky0oqBVAo0KvaqWlyI",
        apiUrl: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
        
        getMove: async function(game) {
            const pgn = game.pgn();
            const fen = game.fen();
            const legalMoves = game.moves();

            const prompt = `
You are a world-class chess engine. It is Black's turn to move.
Your thinking process must follow these four steps:
1.  Read the Game History (PGN) and the Current Position (FEN).
2.  Analyze the current position, considering material, king safety, and key threats.
3.  Based on White's (the opponent's) moves in the PGN, analyze their likely strategy and predict their next 2-3 possible moves.
4.  State your chosen move.

Here is the game data:
- Game History (PGN): "${pgn}"
- Current Position (FEN): "${fen}"
- Legal Moves for Black: [${legalMoves.join(', ')}]

Provide your analysis based on the four steps above. Then, on a final, separate line, write "Best Move:" followed by your single best move in Standard Algebraic Notation.
            `;

            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { "temperature": 0.5 }
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const result = await response.json();
            if (!result.candidates || result.candidates.length === 0) {
                 throw new Error("API returned no candidates.");
            }
            
            const fullResponse = result.candidates[0].content.parts[0].text.trim();
            
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

            if (thoughts.length > 0) {
                console.log(`--- ${this.name} is Thinking ---`);
                console.log(thoughts.join('\n'));
                console.log("--------------------------");
            }

            if (!aiMove) {
                console.warn(`AI (${this.name}) did not use 'Best Move:' format. Taking last line as move.`);
                aiMove = lines[lines.length - 1].trim();
            }

            return aiMove.replace(/\.$/, '');
        }
    };
    
    // ===================================================================
    //  UI, STORAGE, and GAME STATE FUNCTIONS
    // ===================================================================
    
    function updateGameInfo(move) {
        let statusText = '';
        const moveColor = game.turn() === 'b' ? 'Black' : 'White';
        
        if (game.in_checkmate()) {
            const winner = game.turn() === 'b' ? 'White (Llama)' : 'Black (Gemini)';
            statusText = `Game Over: ${winner} wins by Checkmate.`;
        } else if (game.in_draw()) {
            statusText = 'Game Over: Draw.';
        } else {
            const nextPlayer = game.turn() === 'w' ? 'White (Llama)' : 'Black (Gemini)';
            statusText = `${nextPlayer} to move.`;
        }
        
        statusEl.html(statusText);
        
        if (game.game_over()) {
            overlayEl.css('display', 'flex');
            isGameRunning = false;
        }

        pgnEl.html(game.pgn());
        pgnEl.parent().scrollTop(pgnEl.parent()[0].scrollHeight);
        
        if (move && move.captured) {
            const pieceColor = move.color === 'w' ? 'b' : 'w';
            const capturedPiece = pieceSymbols[pieceColor + move.captured.toUpperCase()];
            if (move.color === 'w') {
                blackCaptured.push(capturedPiece);
                capturedByWhiteEl.html(blackCaptured.join(' '));
            } else {
                whiteCaptured.push(capturedPiece);
                capturedByBlackEl.html(whiteCaptured.join(' '));
            }
        }
        
        // Save progress
        try {
            localStorage.setItem('chessGamePgn', game.pgn());
            localStorage.setItem('chessGameWhiteCaptured', JSON.stringify(whiteCaptured));
            localStorage.setItem('chessGameBlackCaptured', JSON.stringify(blackCaptured));
        } catch (e) { console.error("LocalStorage save failed: ", e); }
    }

    function startGame() {
        resetGame();
        isGameRunning = true;
        playNextTurn();
    }

    function resetGame() {
        isGameRunning = false;
        game.reset();
        board.start();
        whiteCaptured = [];
        blackCaptured = [];
        aiStatusEl.hide();
        
        try {
            localStorage.removeItem('chessGamePgn');
            localStorage.removeItem('chessGameWhiteCaptured');
            localStorage.removeItem('chessGameBlackCaptured');
        } catch (e) { console.error("LocalStorage clear failed: ", e); }
        
        updateGameInfo(); 
        capturedByWhiteEl.html('');
        capturedByBlackEl.html('');
    }
    
    function loadGameFromStorage() {
        try {
            const savedPgn = localStorage.getItem('chessGamePgn');
            if (savedPgn && savedPgn.length > 0) {
                game.load_pgn(savedPgn);
                const savedWhiteCaptured = JSON.parse(localStorage.getItem('chessGameWhiteCaptured') || '[]');
                const savedBlackCaptured = JSON.parse(localStorage.getItem('chessGameBlackCaptured') || '[]');
                whiteCaptured = savedWhiteCaptured;
                blackCaptured = savedBlackCaptured;
                capturedByBlackEl.html(whiteCaptured.join(' '));
                capturedByWhiteEl.html(blackCaptured.join(' '));
                isGameRunning = true;
                setTimeout(playNextTurn, 1000);
            } else {
                overlayEl.css('display', 'flex');
            }
        } catch (e) {
            console.error("LocalStorage load failed.", e);
            resetGame();
        }
        board.position(game.fen());
        updateGameInfo();
    }

    // ===================================================================
    //  CHESSBOARD AND EVENT HANDLERS
    // ===================================================================
    const config = { draggable: false, position: 'start', pieceTheme: 'img/chesspieces/wikipedia/{piece}.png' };
    board = Chessboard('myBoard', config);
    $(window).on('resize', board.resize);
    
    $('#overlay-new-game-btn').on('click', function() {
        overlayEl.hide();
        startGame();
    });

    $('#new-game-btn').on('click', function() {
        resetGame();
        overlayEl.css('display', 'flex');
    });

    $('#flip-board-btn').on('click', () => board.flip());

    // --- Initial Game Setup ---
    loadGameFromStorage();
});
