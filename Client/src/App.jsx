import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const App = () => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [playerMark, setPlayerMark] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [status, setStatus] = useState('disconnected');
  const socketRef = useRef(null);

  // Инициализация сокета
  useEffect(() => {
    socketRef.current = io('https://your-app.onrender.com', {
      transports: ['websocket']
    });

    socketRef.current.on('game_state', (data) => {
      setBoard(data.board);
      setCurrentPlayer(data.currentPlayer);
    });

    socketRef.current.on('assign_mark', (mark) => {
      setPlayerMark(mark);
    });

    socketRef.current.on('game_over', (winner) => {
      alert(winner ? `Победитель: ${winner}` : 'Ничья!');
    });

    socketRef.current.on('opponent_left', () => {
      alert('Соперник покинул игру');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Обработка хода
  const handleClick = (index) => {
    if (
      !board[index] && 
      playerMark === currentPlayer && 
      status === 'playing'
    ) {
      socketRef.current.emit('make_move', index);
    }
  };

  // Начало игры
  const startGame = async () => {
    const name = prompt('Введите ваше имя');
    if (name) {
      socketRef.current.emit('join_game', name);
      setStatus('waiting');
    }
  };

  // Рендер ячейки
  const renderSquare = (index) => (
    <button 
      className={`square ${board[index]}`}
      onClick={() => handleClick(index)}
      disabled={
        !!board[index] || 
        playerMark !== currentPlayer || 
        status !== 'playing'
      }
    >
      {board[index]}
    </button>
  );

  return (
    <div className="game">
      {status === 'disconnected' && (
        <button onClick={startGame}>Начать игру</button>
      )}
      
      {status === 'waiting' && <div>Ожидаем соперника...</div>}
      
      {status === 'playing' && (
        <div className="board">
          <div className="board-row">
            {renderSquare(0)}
            {renderSquare(1)}
            {renderSquare(2)}
          </div>
          <div className="board-row">
            {renderSquare(3)}
            {renderSquare(4)}
            {renderSquare(5)}
          </div>
          <div className="board-row">
            {renderSquare(6)}
            {renderSquare(7)}
            {renderSquare(8)}
          </div>
          <div>Ваш символ: {playerMark}</div>
          <div>Сейчас ходит: {currentPlayer}</div>
        </div>
      )}
    </div>
  );
};

export default App;