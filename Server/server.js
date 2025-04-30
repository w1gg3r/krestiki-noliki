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
  console.log('Новое подключение:', socket.id);

  socket.on('join_game', (playerName) => {
    if (gameState.waitingPlayer) {
      // Найден второй игрок
      gameState.players[socket.id] = {
        name: playerName,
        mark: 'O'
      };
      
      gameState.players[gameState.waitingPlayer.id].mark = 'X';
      
      // Отправляем метки игрокам
      socket.emit('assign_mark', 'O');
      io.to(gameState.waitingPlayer.id).emit('assign_mark', 'X');
      
      // Уведомляем о начале игры
      socket.emit('game_start', { name: gameState.waitingPlayer.name });
      io.to(gameState.waitingPlayer.id).emit('game_start', { name: playerName });
      
      // Отправляем начальное состояние
      sendGameState();
      
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
      index >= 0 && index < 9 &&
      gameState.board[index] === null &&
      gameState.players[socket.id]?.mark === gameState.currentPlayer
    ) {
      gameState.board[index] = gameState.currentPlayer;
      
      const winner = checkWinner();
      if (winner) {
        io.emit('game_over', winner);
        resetGame();
        return;
      }
      
      gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
      sendGameState();
    }
  });

  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      io.emit('opponent_left');
      resetGame();
    }
  });

  function checkWinner() {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        gameState.board[a] &&
        gameState.board[a] === gameState.board[b] &&
        gameState.board[a] === gameState.board[c]
      ) {
        return gameState.board[a];
      }
    }

    return gameState.board.includes(null) ? null : 'draw';
  }

  function sendGameState() {
    io.emit('game_update', {
      board: gameState.board,
      currentPlayer: gameState.currentPlayer
    });
  }

  function resetGame() {
    gameState.board = Array(9).fill(null);
    gameState.currentPlayer = 'X';
    gameState.players = {};
    gameState.waitingPlayer = null;
  }
});

httpServer.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});