import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import './App.css';

const initialBoard = Array(3).fill().map(() => Array(3).fill(null));

const App = () => {
  const [board, setBoard] = useState(initialBoard);
  const [playerName, setPlayerName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const socketRef = useRef(null);

  // Инициализация сокета
  const initSocket = () => {
    const socket = io('https://krestiki-noliki-xkam.onrender.com', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      setStatus('connected');
    });

    socket.on('opponent_found', (data) => {
      setOpponentName(data.opponentName);
      setPlayerSymbol(data.symbol);
      setCurrentPlayer(data.symbol === 'X' ? 'X' : 'O');
      setStatus('playing');
    });

    socket.on('opponent_move', ({ row, col }) => {
      const newBoard = [...board];
      newBoard[row][col] = playerSymbol === 'X' ? 'O' : 'X';
      setBoard(newBoard);
      setCurrentPlayer(playerSymbol);
      checkWinner(newBoard);
    });

    socket.on('opponent_left', () => {
      setStatus('opponent_left');
      Swal.fire('Соперник покинул игру');
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setStatus('error');
    });

    socketRef.current = socket;
    return socket;
  };

  // Проверка победителя
  const checkWinner = (currentBoard) => {
    const lines = [
      // Горизонтали
      [[0,0], [0,1], [0,2]],
      [[1,0], [1,1], [1,2]],
      [[2,0], [2,1], [2,2]],
      // Вертикали
      [[0,0], [1,0], [2,0]],
      [[0,1], [1,1], [2,1]],
      [[0,2], [1,2], [2,2]],
      // Диагонали
      [[0,0], [1,1], [2,2]],
      [[0,2], [1,1], [2,0]]
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (currentBoard[a[0]][a[1]] && 
          currentBoard[a[0]][a[1]] === currentBoard[b[0]][b[1]] && 
          currentBoard[a[0]][a[1]] === currentBoard[c[0]][c[1]]) {
        setWinner(currentBoard[a[0]][a[1]]);
        return;
      }
    }

    // Проверка на ничью
    if (currentBoard.flat().every(cell => cell !== null)) {
      setWinner('draw');
    }
  };

  // Обработка хода игрока
  const handleCellClick = (row, col) => {
    if (board[row][col] || winner || currentPlayer !== playerSymbol) return;

    const newBoard = [...board];
    newBoard[row][col] = playerSymbol;
    setBoard(newBoard);
    setCurrentPlayer(playerSymbol === 'X' ? 'O' : 'X');

    if (socketRef.current) {
      socketRef.current.emit('make_move', { row, col, symbol: playerSymbol });
    }

    checkWinner(newBoard);
  };

  // Начало игры
  const startGame = async () => {
    const { value: name } = await Swal.fire({
      title: 'Введите ваше имя',
      input: 'text',
      showCancelButton: true,
      inputValidator: (value) => !value && 'Пожалуйста, введите имя!'
    });

    if (!name) return;

    setPlayerName(name);
    const socket = initSocket();
    socket.emit('request_to_play', name);
    setStatus('waiting');
  };

  // Сброс игры
  const resetGame = () => {
    setBoard(initialBoard);
    setWinner(null);
    if (socketRef.current) {
      socketRef.current.emit('request_to_play', playerName);
      setStatus('waiting');
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="app">
      {status === 'disconnected' && (
        <button className="start-button" onClick={startGame}>
          Начать игру
        </button>
      )}

      {status === 'waiting' && (
        <div className="waiting-message">
          <p>Ожидание соперника...</p>
          <p>Ваше имя: {playerName}</p>
        </div>
      )}

      {status === 'playing' && (
        <>
          <div className="game-info">
            <p>Вы: {playerName} ({playerSymbol})</p>
            <p>Соперник: {opponentName} ({playerSymbol === 'X' ? 'O' : 'X'})</p>
            <p>Ход: {currentPlayer === playerSymbol ? 'Ваш' : 'Соперника'}</p>
          </div>

          <div className="board">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="board-row">
                {row.map((cell, colIndex) => (
                  <button
                    key={colIndex}
                    className={`cell ${cell ? `cell-${cell.toLowerCase()}` : ''}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    disabled={!!cell || winner || currentPlayer !== playerSymbol}
                  >
                    {cell}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {winner && (
        <div className="game-over">
          <h2>
            {winner === 'draw' ? 'Ничья!' : 
             winner === playerSymbol ? 'Вы победили!' : 'Вы проиграли!'}
          </h2>
          <button onClick={resetGame}>Играть снова</button>
        </div>
      )}

      {status === 'opponent_left' && (
        <div className="game-over">
          <h2>Соперник покинул игру</h2>
          <button onClick={resetGame}>Играть снова</button>
        </div>
      )}
    </div>
  );
};

export default App;