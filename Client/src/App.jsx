import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const App = () => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [playerMark, setPlayerMark] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [status, setStatus] = useState('disconnected');
  const [opponentName, setOpponentName] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    // Подключение к серверу
    socketRef.current = io('https://krestiki-noliki-xkam.onrender.com', {
      transports: ['websocket'],
      reconnection: true
    });

    // Обработчики событий
    socketRef.current.on('connect', () => {
      setStatus('connected');
    });

    socketRef.current.on('game_update', (data) => {
      setBoard(data.board);
      setCurrentPlayer(data.currentPlayer);
    });

    socketRef.current.on('assign_mark', (mark) => {
      setPlayerMark(mark);
    });

    socketRef.current.on('game_start', (opponent) => {
      setOpponentName(opponent.name);
      setStatus('playing');
    });

    socketRef.current.on('game_over', (result) => {
      alert(result === 'draw' ? 'Ничья!' : `Победитель: ${result}`);
      resetGame();
    });

    socketRef.current.on('opponent_left', () => {
      alert('Соперник покинул игру');
      resetGame();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleClick = (index) => {
    if (
      !board[index] && 
      playerMark === currentPlayer && 
      status === 'playing' &&
      socketRef.current
    ) {
      socketRef.current.emit('make_move', index);
    }
  };

  const startGame = () => {
    const name = prompt('Введите ваше имя:');
    if (name && socketRef.current) {
      socketRef.current.emit('join_game', name);
      setStatus('waiting');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setStatus('disconnected');
    setPlayerMark(null);
    setOpponentName('');
  };

  const renderSquare = (index) => (
    <button
      className={`square ${board[index] || ''}`}
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
    <div className="game-container">
      {status === 'disconnected' && (
        <button className="start-btn" onClick={startGame}>
          Начать игру
        </button>
      )}

      {status === 'waiting' && (
        <div className="waiting">Ожидание соперника...</div>
      )}

      {status === 'playing' && (
        <>
          <div className="game-info">
            <p>Вы: {playerMark}</p>
            <p>Соперник: {opponentName}</p>
            <p>Ход: {currentPlayer === playerMark ? 'Ваш' : 'Соперника'}</p>
          </div>
          
          <div className="board">
            {[0, 1, 2].map((row) => (
              <div key={row} className="board-row">
                {[0, 1, 2].map((col) => renderSquare(row * 3 + col))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default App;