$(document).ready(function() {
    // --- Global Variables ---
    let board = null;
    const game = new Chess();
    let isGameRunning = false;
    let moveIndex = 0;

    // --- DOM Elements ---
    const statusEl = $('#status');
    const pgnEl = $('#pgn');
    const capturedByBlackEl = $('#captured-by-black');
    const capturedByWhiteEl = $('#captured-by-white');
    const overlayEl = $('#game-overlay');
    const gameIndicatorEl = $('#game-indicator'); // New indicator element

    // --- Piece Tracking ---
    let whiteCaptured = [];
    let blackCaptured = [];
    const pieceSymbols = { 'wP': '♙', 'wN': '♘', 'wB': '♗', 'wR': '♖', 'wQ': '♕', 'wK': '♔', 'bP': '♟', 'bN': '♞', 'bB': '♝', 'bR': '♜', 'bQ': '♛', 'bK': '♚' };

    // ===================================================================
    //  SCRIPTED GAME SETUP
    // ===================================================================

    // The moves from the "Game of the Century" - D. Byrne vs. R. Fischer, 1956
    const scriptedMoves = [
        'Nf3', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'd4', 'O-O', 'Bf4', 'd5', 'Qb3', 
        'dxc4', 'Qxc4', 'c6', 'e4', 'Nbd7', 'Rd1', 'Nb6', 'Qc5', 'Bg4', 'Bg5', 
        'Na4', 'Qa3', 'Nxc3', 'bxc3', 'Nxe4', 'Bxe7', 'Qb6', 'Bc4', 'Nxc3', 
        'Bc5', 'Rfe8+', 'Kf1', 'Be6', 'Bxb6', 'Bxc4+', 'Kg1', 'Ne2+', 'Kf1', 
        'Nxd4+', 'Kg1', 'Ne2+', 'Kf1', 'Nc3+', 'Kg1', 'axb6', 'Qb4', 'Ra4', 
        'Qxb6', 'Nxd1', 'h3', 'Rxa2', 'Kh2', 'Nxf2', 'Re1', 'Rxe1', 'Qd8+', 
        'Bf8', 'Nxe1', 'Bd5', 'Nf3', 'Ne4', 'Qb8', 'b5', 'h4', 'h5', 'Ne5', 
        'Kg7', 'Kg1', 'Bc5+', 'Kf1', 'Ng3+', 'Ke1', 'Bb4+', 'Kd1', 'Bb3+', 
        'Kc1', 'Ne2+', 'Kb1', 'Nc3+', 'Kc1', 'Rc2#'
    ];

    /**
     * This is the main game loop that plays the next move from the script.
     * It now includes a "thinking" state with a random delay.
     */
    function playNextScriptedMove() {
        if (!isGameRunning || moveIndex >= scriptedMoves.length) {
            isGameRunning = false;
            updateGameInfo(null); // Update status for checkmate/draw
            return;
        }

        // Determine who is "thinking" and update the indicator
        const moveColor = game.turn() === 'w' ? 'GPT-4' : 'Gemini-AI';
        const indicatorClass = moveColor === 'GPT-4' ? 'indicator-white' : 'indicator-black';
        gameIndicatorEl.text(`${moveColor} is thinking...`)
                       .removeClass('indicator-white indicator-black indicator-winner')
                       .addClass(indicatorClass)
                       .show();

        // Calculate a random delay between 1 and 5 seconds
        const randomDelay = Math.floor(Math.random() * 4000) + 1000;

        // Wait for the random delay before making the move
        setTimeout(() => {
            // Check again in case the game was reset during the delay
            if (!isGameRunning) return;

            const move = scriptedMoves[moveIndex];
            const moveResult = game.move(move, { sloppy: true });

            if (moveResult === null) {
                console.error(`Invalid move in script at index ${moveIndex}: ${move}`);
                gameIndicatorEl.text("Error: Invalid move in script.").show();
                isGameRunning = false;
                return;
            }

            // Success, update the board and UI
            board.position(game.fen());
            updateGameInfo(moveResult);
            moveIndex++;

            // Immediately start the process for the next move
            playNextScriptedMove();

        }, randomDelay);
    }

    // ===================================================================
    //  UI AND GAME STATE FUNCTIONS
    // ===================================================================
    
    function updateGameInfo(move) {
        let statusText = '';
        
        if (game.in_checkmate()) {
            const winner = game.turn() === 'b' ? 'GPT-4' : 'Gemini';
            statusText = `Game Over`;
            gameIndicatorEl.text(`${winner} wins by Checkmate!`)
                           .removeClass('indicator-white indicator-black')
                           .addClass('indicator-winner')
                           .show();
            isGameRunning = false;
        } else if (game.in_draw()) {
            statusText = 'Game Over';
            gameIndicatorEl.text(`Game is a Draw.`)
                           .removeClass('indicator-white indicator-black')
                           .addClass('indicator-winner')
                           .show();
            isGameRunning = false;
        } else if (isGameRunning) {
            // This is handled by the thinking indicator, so we clear the main status
            statusText = ' '; 
        } else {
            statusText = "Ready to Start";
        }
        
        statusEl.html(statusText);
        
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
    }

    function startGame() {
        resetGame();
        isGameRunning = true;
        playNextScriptedMove();
    }

    function resetGame() {
        isGameRunning = false;
        game.reset();
        board.start();
        moveIndex = 0;
        whiteCaptured = [];
        blackCaptured = [];
        gameIndicatorEl.hide(); // Hide indicator on reset
        updateGameInfo(null); 
        capturedByWhiteEl.html('');
        capturedByBlackEl.html('');
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
    overlayEl.css('display', 'flex'); // Show the start button initially
});
