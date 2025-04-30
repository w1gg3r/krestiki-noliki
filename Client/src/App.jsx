import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Использование комнаты для группировки игроков одной игры (для масштабирования, если нужно)
// В данном случае с одной игрой это просто хорошая практика.
const GAME_ROOM = 'tic-tac-toe-room';

// Глобальное состояние игры (для одной игры на сервере)
const gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X', // 'X' всегда начинает
  players: {}, // { socket.id: { name: '...', mark: 'X'|'O', opponentId: '...' } }
  waitingPlayerId: null // ID сокета игрока, ожидающего оппонента
};

const io = new Server(httpServer, {
  cors: {
    origin: "*", // В продакшене лучше указать конкретные источники
    methods: ["GET", "POST"]
  }
});

// Функция для сброса игры до начального состояния
function resetGame() {
  console.log('Resetting game state');
  gameState.board = Array(9).fill(null);
  gameState.currentPlayer = 'X';
  // Важно: Не очищаем players сразу, чтобы можно было отправить сообщения
  // перед полной очисткой или предложить сыграть снова.
  // Очистим игроков после отправки сообщений об окончании/сбросе.
  // gameState.players = {}; // Очищается после обработки отключения или окончания
  gameState.waitingPlayerId = null;
}

// Функция для проверки победителя или ничьей
function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Возвращаем 'X' или 'O'
    }
  }

  // Проверяем на ничью (если нет пустых клеток и нет победителя)
  return board.includes(null) ? null : 'draw'; // Возвращаем 'draw' или null
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Обработка запроса на присоединение к игре
  socket.on('join_game', (playerName) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
        console.log(`Connection ${socket.id} attempted to join with invalid name.`);
        socket.emit('join_error', 'Please provide a valid player name.');
        return;
    }

    // Проверяем, не является ли игрок уже в игре (переподключение?)
    if (gameState.players[socket.id]) {
        console.log(`Player ${playerName} (${socket.id}) is already in the game state.`);
        // Можно отправить текущее состояние или сообщение об ошибке/переподключении
        socket.emit('game_state', {
            board: gameState.board,
            currentPlayer: gameState.currentPlayer,
            players: Object.values(gameState.players).map(p => ({ name: p.name, mark: p.mark })) // Отправляем имена и метки игроков
        });
        socket.emit('assign_mark', gameState.players[socket.id].mark);
        return;
    }

    // Проверяем, есть ли уже два игрока
    if (Object.keys(gameState.players).length >= 2) {
      console.log(`Connection ${socket.id} attempted to join, but game is full.`);
      socket.emit('join_error', 'Game is currently full.');
      return;
    }

    // Если есть ожидающий игрок
    if (gameState.waitingPlayerId) {
      const waitingSocketId = gameState.waitingPlayerId;
      const waitingPlayer = gameState.players[waitingSocketId];

      if (!waitingPlayer) {
          // Упс, ожидающий игрок куда-то делся без корректного сброса?
          console.error(`Waiting player ${waitingSocketId} not found in gameState.players.`);
          gameState.waitingPlayerId = null; // Сбрасываем ожидающего
          // Позволяем текущему игроку стать ожидающим
          gameState.players[socket.id] = { name: playerName, mark: 'X', opponentId: null };
          gameState.waitingPlayerId = socket.id;
          console.log(`Player ${playerName} (${socket.id}) is now waiting.`);
          socket.emit('assign_mark', 'X');
          // Можно уведомить игрока, что он ждет
          socket.emit('waiting_for_opponent');
          return;
      }

      console.log(`Player ${playerName} (${socket.id}) joined game against ${waitingPlayer.name} (${waitingSocketId}).`);

      // Назначаем метки и связываем игроков
      gameState.players[socket.id] = { name: playerName, mark: 'O', opponentId: waitingSocketId };
      gameState.players[waitingSocketId].opponentId = socket.id;
      gameState.players[waitingSocketId].mark = 'X'; // Убеждаемся, что ожидающий получил 'X'

      // Добавляем обоих игроков в комнату
      socket.join(GAME_ROOM);
      io.sockets.sockets.get(waitingSocketId)?.join(GAME_ROOM); // Находим сокет ожидающего и добавляем его в комнату

      // Уведомляем игроков об их метках
      socket.emit('assign_mark', 'O');
      io.to(waitingSocketId).emit('assign_mark', 'X');

      // Отправляем начальное состояние игры обоим игрокам в комнате
      io.to(GAME_ROOM).emit('game_state', {
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        players: Object.values(gameState.players).map(p => ({ name: p.name, mark: p.mark }))
      });

      // Сбрасываем ожидающего игрока
      gameState.waitingPlayerId = null;

      console.log(`Game started between ${waitingPlayer.name} (X) and ${playerName} (O).`);

    } else {
      // Первый игрок, становится ожидающим
      console.log(`Player ${playerName} (${socket.id}) is waiting for an opponent.`);
      gameState.players[socket.id] = { name: playerName, mark: 'X', opponentId: null }; // Назначаем 'X' сразу первому игроку
      gameState.waitingPlayerId = socket.id;

      socket.emit('assign_mark', 'X');
      // Можно отправить сообщение игроку, что он ждет
      socket.emit('waiting_for_opponent');
    }
  });

  // Обработка хода игрока
  socket.on('make_move', (index) => {
    const player = gameState.players[socket.id];

    // Проверки перед ходом
    if (!player) {
      console.log(`Move attempt by non-player socket: ${socket.id}`);
      // Можно отправить ошибку, что игрок не в игре
      socket.emit('move_error', 'You are not currently in a game.');
      return;
    }

    if (Object.keys(gameState.players).length < 2) {
        console.log(`Move attempt before game started by: ${socket.id}`);
        socket.emit('move_error', 'Waiting for opponent to join.');
        return;
    }

    if (gameState.board[index] !== null) {
      console.log(`Move attempt on occupied square ${index} by ${player.name}`);
      socket.emit('move_error', 'This square is already taken.');
      return;
    }

    if (player.mark !== gameState.currentPlayer) {
      console.log(`Move attempt out of turn by ${player.name} (expected ${gameState.currentPlayer}, got ${player.mark})`);
      socket.emit('move_error', `It's not your turn. Waiting for ${gameState.currentPlayer}.`);
      return;
    }

    // Ход корректен, обновляем состояние
    console.log(`Player ${player.name} (${socket.id}) makes move at index ${index}`);
    gameState.board[index] = gameState.currentPlayer;

    // Проверка победителя или ничьей
    const winner = checkWinner(gameState.board);

    if (winner) {
      console.log(`Game over. Result: ${winner}`);
      // Отправляем результат всем в комнате
      io.to(GAME_ROOM).emit('game_over', winner);
      // Отправляем финальное состояние доски
      io.to(GAME_ROOM).emit('game_state', {
          board: gameState.board,
          currentPlayer: gameState.currentPlayer, // Текущий игрок останется тем, кто сделал последний ход
          players: Object.values(gameState.players).map(p => ({ name: p.name, mark: p.mark }))
      });

      // Сбрасываем игру после небольшой задержки или по запросу игроков
      // Простая реализация - сброс сразу и очистка игроков
      const playerIds = Object.keys(gameState.players);
      playerIds.forEach(id => {
        io.sockets.sockets.get(id)?.leave(GAME_ROOM); // Удаляем игроков из комнаты
      });
      gameState.players = {}; // Очищаем игроков
      resetGame(); // Сбрасываем доску и текущего игрока

      return;
    }

    // Если нет победителя, меняем ход
    gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    console.log(`Next turn: ${gameState.currentPlayer}`);

    // Отправляем обновленное состояние игры всем в комнате
    io.to(GAME_ROOM).emit('game_state', {
      board: gameState.board,
      currentPlayer: gameState.currentPlayer,
      players: Object.values(gameState.players).map(p => ({ name: p.name, mark: p.mark }))
    });
  });

  // Обработка отключения сокета
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    const player = gameState.players[socket.id];

    // Если отключившийся сокет был игроком
    if (player) {
      console.log(`Player ${player.name} (${socket.id}) disconnected.`);

      const opponentId = player.opponentId;

      // Удаляем игрока из списка
      delete gameState.players[socket.id];

      // Если был ожидающим игроком
      if (gameState.waitingPlayerId === socket.id) {
        console.log('Waiting player disconnected.');
        gameState.waitingPlayerId = null;
      }

      // Если у него был оппонент (т.е., игра шла)
      if (opponentId && gameState.players[opponentId]) {
        console.log(`Opponent ${gameState.players[opponentId].name} (${opponentId}) left alone.`);
        // Уведомляем оставшегося игрока
        io.to(opponentId).emit('opponent_left', `${player.name} has left the game.`);

        // Удаляем оставшегося игрока из списка и комнаты
        io.sockets.sockets.get(opponentId)?.leave(GAME_ROOM);
        delete gameState.players[opponentId];

        // Сбрасываем игру
        resetGame();
      } else {
         // Если игрока не было в паре (например, он был ожидающим и отключился до того, как нашелся оппонент)
         // или если оппонента уже нет в списке (он отключился раньше)
         console.log('Disconnected player had no active opponent.');
         // Если игра была в процессе и один игрок остался, но затем отключился,
         // состояние уже могло быть сброшено первым отключением.
         // Если это был одинокий ожидающий, мы уже сбросили waitingPlayerId.
         // Дополнительный сброс gameState.players уже произошел выше.
         // resetGame(); // Сброс уже произошел или не нужен
      }

       // В любом случае, если игрок отключился, убедимся, что комната пуста или сброшена
       // Эта логика уже частично покрыта очисткой players и выходом из комнаты выше.
       // Если игроков больше нет, состояние игры должно быть сброшено.
       if (Object.keys(gameState.players).length === 0 && (gameState.board.some(cell => cell !== null) || gameState.waitingPlayerId !== null)) {
           console.log('All players disconnected, forcing game state reset.');
           resetGame();
           gameState.players = {}; // Убедиться, что список игроков пуст после сброса
       }

    } else {
      console.log(`Disconnected socket ${socket.id} was not a player.`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});