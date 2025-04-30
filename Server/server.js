import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Настройка Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Состояние игры
const allUsers = {};
const allRooms = [];

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Роуты HTTP
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'running',
    game: 'Крестики-Нолики',
    websocket: true,
    players: Object.keys(allUsers).length,
    rooms: allRooms.length
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Логика WebSocket
io.on('connection', (socket) => {
  console.log(`Новое подключение: ${socket.id}`);
  
  allUsers[socket.id] = {
    socket: socket,
    online: true,
    playing: false
  };

  socket.on('request_to_play', (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;
    currentUser.playing = true;

    let opponentPlayer;

    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      const room = {
        player1: opponentPlayer,
        player2: currentUser,
        id: `room_${allRooms.length + 1}`
      };
      
      allRooms.push(room);

      currentUser.socket.emit('OpponentFound', {
        opponentName: opponentPlayer.playerName,
        playingAs: "circle",
        roomId: room.id
      });

      opponentPlayer.socket.emit('OpponentFound', {
        opponentName: currentUser.playerName,
        playingAs: "cross",
        roomId: room.id
      });

      currentUser.socket.on('playerMoveFromClient', (data) => {
        opponentPlayer.socket.emit('playerMoveFromServer', data);
      });

      opponentPlayer.socket.on('playerMoveFromClient', (data) => {
        currentUser.socket.emit('playerMoveFromServer', data);
      });
    } else {
      currentUser.socket.emit('OpponentNotFound');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Отключение: ${socket.id}`);
    const currentUser = allUsers[socket.id];
    if (currentUser) {
      currentUser.online = false;
      currentUser.playing = false;

      for (let index = 0; index < allRooms.length; index++) {
        const { player1, player2 } = allRooms[index];

        if (player1.socket.id === socket.id) {
          player2.socket.emit('opponentLeftMatch');
          allRooms.splice(index, 1);
          break;
        }

        if (player2.socket.id === socket.id) {
          player1.socket.emit('opponentLeftMatch');
          allRooms.splice(index, 1);
          break;
        }
      }
    }
  });
});

// Роуты для проверки работоспособности
app.get('/', (req, res) => res.send('Сервер крестиков-ноликов работает'));
app.get('/health', (req, res) => res.send('OK'));

// Уникальное решение для Render
const startServer = (attempt = 1) => {
  const PORT = attempt === 1 ? (process.env.PORT || 10000) : 0;
  
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер успешно запущен на порту ${httpServer.address().port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Порт ${PORT} занят, пробуем случайный порт...`);
      httpServer.close(() => startServer(attempt + 1));
    } else {
      console.error('Фатальная ошибка:', err);
      process.exit(1);
    }
  });
};

// Запускаем сервер
startServer();

// Обработка завершения работы
process.on('SIGTERM', () => {
  console.log('Получен сигнал завершения');
  httpServer.close(() => process.exit(0));
});