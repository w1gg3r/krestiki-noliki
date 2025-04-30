import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Автоматическое определение путей к фронтенду
const frontendPath = (() => {
  const possiblePaths = [
    '/opt/render/project/Client/dist',
    '/opt/render/project/client/dist',
    '/opt/render/project/src/Client/dist',
    path.join(__dirname, '../Client/dist'),
    path.join(__dirname, '../../Client/dist')
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log('Фронтенд найден по пути:', path);
      return path;
    }
  }
  throw new Error('Фронтенд не найден');
})();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Состояние игры
const playersQueue = [];
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Новый игрок подключен: ${socket.id}`);

  socket.on('request_to_play', (playerName) => {
    // Добавляем проверку на тип данных
    const name = typeof playerName === 'object' ? playerName.playerName : playerName;
    
    if (!name || typeof name !== 'string') {
      console.error('Неверный формат имени:', playerName);
      socket.emit('error', 'Неверное имя игрока');
      return;
    }

    console.log(`Поиск соперника для: ${name}`);

    if (playersQueue.length > 0) {
      const opponent = playersQueue.pop();
      const roomId = `room_${Date.now()}`;
      
      activeRooms.set(roomId, {
        players: [
          { id: socket.id, name, symbol: 'X' },
          { id: opponent.id, name: opponent.name, symbol: 'O' }
        ],
        moves: []
      });

      // Улучшенное логирование
      console.log(`Создана комната ${roomId} между ${name} (X) и ${opponent.name} (O)`);

      socket.emit('opponent_found', { 
        opponentName: opponent.name,
        symbol: 'X',
        roomId
      });

      opponent.socket.emit('opponent_found', {
        opponentName: name,
        symbol: 'O',
        roomId
      });
    } else {
      playersQueue.push({
        id: socket.id,
        name,
        socket: socket
      });
      socket.emit('waiting_for_opponent');
      console.log(`Игрок ${name} добавлен в очередь ожидания`);
    }
  });

  socket.on('make_move', (data) => {
    const { roomId, cellIndex, symbol } = data;
    const room = activeRooms.get(roomId);
  
    if (room) {
      room.moves.push({ cellIndex, symbol });
      // Отправляем ход сопернику с символом!
      const opponent = room.players.find(p => p.id !== socket.id);
      if (opponent) {
        io.to(opponent.id).emit('opponent_move', { cellIndex, symbol });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Игрок отключился: ${socket.id}`);
    
    // Удаляем из очереди
    const index = playersQueue.findIndex(p => p.id === socket.id);
    if (index !== -1) {
      playersQueue.splice(index, 1);
    }

    // Уведомляем соперника о выходе
    for (const [roomId, room] of activeRooms) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent) {
          io.to(opponent.id).emit('opponent_left');
        }
        activeRooms.delete(roomId);
        break;
      }
    }
  });
});

// Статические файлы фронтенда
app.use(express.static(frontendPath));

// API проверки статуса
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    playersInQueue: playersQueue.length,
    activeGames: activeRooms.size
  });
});

// Все остальные запросы → на фронтенд
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Ожидающие игроки: ${playersQueue.length}`);
  console.log(`Активные игры: ${activeRooms.size}`);
});