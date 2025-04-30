import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  players: {},
  waitingPlayer: null
};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join_game', (playerName) => {
    if (gameState.waitingPlayer) {
      // Найден второй игрок
      gameState.players[socket.id] = {
        name: playerName,
        mark: 'O'
      };
      
      gameState.players[gameState.waitingPlayer.id].mark = 'X';
      
      socket.emit('assign_mark', 'O');
      io.to(gameState.waitingPlayer.id).emit('assign_mark', 'X');
      
      io.emit('game_state', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer
      });
      
      gameState.waitingPlayer = null;
    } else {
      // Первый игрок
      gameState.players[socket.id] = {
        name: playerName,
        mark: null
      };
      gameState.waitingPlayer = {
        id: socket.id,
        name: playerName
      };
    }
  });

  socket.on('make_move', (index) => {
    if (
      gameState.board[index] === null && 
      gameState.players[socket.id].mark === gameState.currentPlayer
    ) {
      gameState.board[index] = gameState.currentPlayer;
      
      // Проверка победителя
      const winner = checkWinner(gameState.board);
      if (winner) {
        io.emit('game_over', winner);
        resetGame();
        return;
      }
      
      // Смена хода
      gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
      io.emit('game_state', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer
      });
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      io.emit('opponent_left');
      resetGame();
    }
  });
});

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return board.includes(null) ? null : 'draw';
}

function resetGame() {
  gameState.board = Array(9).fill(null);
  gameState.currentPlayer = 'X';
  gameState.players = {};
  gameState.waitingPlayer = null;
}

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});