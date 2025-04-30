import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Получаем текущую директорию
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Определяем пути для разработки и продакшена
const isProduction = process.env.NODE_ENV === 'production';
const isRender = process.env.RENDER === 'true';

let frontendPath;
if (isRender) {
  // Путь для Render
  frontendPath = path.join('/opt/render/project/Client/dist');
} else {
  // Путь для локальной разработки
  frontendPath = path.join(__dirname, '../Client/dist');
}

// Логирование для отладки
console.log('Режим:', isProduction ? 'production' : 'development');
console.log('Путь к фронтенду:', frontendPath);

// Проверяем существование папки фронтенда
if (!fs.existsSync(frontendPath)) {
  console.error('ОШИБКА: Папка фронтенда не найдена по пути:', frontendPath);
  console.log('Содержимое проекта:', fs.readdirSync(path.dirname(frontendPath)));
  process.exit(1);
}

// Инициализация сервера
const app = express();
const httpServer = createServer(app);

// Настройка Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*", // На продакшене замените на конкретные домены
    methods: ["GET", "POST"]
  }
});

// Статические файлы фронтенда
app.use(express.static(frontendPath));

// Проверка работоспособности API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    game: 'Крестики-Нолики',
    websocket: true,
    players: Object.keys(allUsers).length,
    rooms: allRooms.length,
    frontendPath: frontendPath
  });
});

// Все остальные запросы перенаправляем на фронтенд
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Состояние игры
const allUsers = {};
const allRooms = [];

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

// Запуск сервера
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ██╗  ██╗██████╗  ██████╗ 
  ██║  ██║██╔══██╗██╔════╝ 
  ███████║██████╔╝██║      
  ██╔══██║██╔══██╗██║      
  ██║  ██║██║  ██║╚██████╗ 
  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝
  
  Сервер запущен на порту ${PORT}
  Фронтенд: ${frontendPath}
  `);
});

// Обработка завершения работы
process.on('SIGTERM', () => {
  console.log('Завершение работы сервера...');
  httpServer.close(() => {
    console.log('Сервер остановлен');
    process.exit(0);
  });
});