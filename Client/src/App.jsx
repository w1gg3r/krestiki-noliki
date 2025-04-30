import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Square from './Square'; // Убедитесь, что путь к Square.jsx правильный
import './App.css'; // Убедитесь, что у вас есть App.css для стилей
// Предполагается, что у вас есть также Square.css, как использовалось ранее

// SVG иконки (можно перенести сюда или оставить в Square.jsx,
// но если они используются только в Square, лучше оставить там)
// const circleSvg = (...)
// const crossSvg = (...)


const App = () => {
  // --- Состояния игры и подключения ---
  const [socket, setSocket] = useState(null);
  const [onlineMode, setOnlineMode] = useState(false); // Режим онлайн игры активен?
  const [playerName, setPlayerName] = useState(''); // Имя текущего игрока
  const [opponentName, setOpponentName] = useState(null); // Имя или объект оппонента
  const [gameState, setGameState] = useState([ // Состояние доски 3x3
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ]);
  const [currentPlayer, setCurrentPlayer] = useState('circle'); // Чей сейчас ход ('circle' или 'cross')
  const [playingAs, setPlayingAs] = useState(null); // За кого играет текущий клиент ('circle' или 'cross')
  const [finishedState, setFinishedState] = useState(null); // Состояние завершения игры (null, 'circle', 'cross', 'draw', 'opponentLeftMatch')
  const [finishedArrayState, setFinishedArrayState] = useState([]); // Массив ID квадратов выигрышной линии

  // --- Эффект для управления Socket.IO ---
  useEffect(() => {
    // Логика подключения к сокету, если режим онлайн активен и сокет еще не создан
    if (onlineMode && !socket) {
      console.log("Attempting to connect to socket...");
      // Замените URL на адрес вашего сервера Socket.IO
      const newSocket = io("http://localhost:3000");
      setSocket(newSocket);

      // Важно: не добавляйте слушатели здесь, добавьте их ниже,
      // когда state.socket гарантированно будет установлен.
    }

    // Логика добавления слушателей событий после установки сокета
    if (socket) {
      console.log("Socket instance available, adding listeners.");

      // --- Слушатели событий от сервера ---

      // Событие успешного подключения
      socket.on("connect", () => {
        console.log("Connected to server");
        // Отправляем запрос на игру только после подключения
        // и только если имя игрока введено
        if (playerName) {
            socket.emit("request_to_play", { playerName: playerName });
        } else {
            console.error("Player name not set when connecting. Disconnecting.");
            // Если имя не задано, нет смысла оставаться подключенным
            setOnlineMode(false); // Вернуться к экрану ввода имени
            socket.disconnect(); // Отключиться
            setSocket(null); // Очистить состояние сокета
        }
      });

      // Событие: найден соперник
      socket.on("opponentFound", (data) => {
        console.log("Opponent found:", data);
        setOpponentName(data.opponentName); // Ожидаем строку с именем оппонента
        setPlayingAs(data.playingAs); // За кого играет текущий клиент ('circle' или 'cross')
        // Сервер также должен прислать начальное состояние доски и первого игрока
        if(data.initialGameState) {
             setGameState(data.initialGameState);
        }
        if(data.startingPlayer) {
             setCurrentPlayer(data.startingPlayer);
        }
        // Сбрасываем состояние завершения, если игра начинается заново
        setFinishedState(null);
        setFinishedArrayState([]);
      });

      // Событие: обновление состояния игры (после хода)
      socket.on("updateGameState", (data) => {
         console.log("Received game state update:", data);
         setGameState(data.board); // Обновляем доску
         setCurrentPlayer(data.currentPlayer); // Обновляем текущего игрока
      });

      // Событие: игра завершена (победа)
      socket.on("gameFinished", (data) => {
        console.log("Game finished (win):", data);
        setFinishedState(data.winner); // Кто победил ('circle' или 'cross')
        setFinishedArrayState(data.winningLine); // Выигрышная линия
      });

      // Событие: ничья
      socket.on("draw", () => {
        console.log("Game ended in a draw");
        setFinishedState("draw");
      });

      // Событие: соперник покинул игру
      socket.on("opponentLeft", () => {
        console.log("Opponent left the match");
        setFinishedState("opponentLeftMatch");
        setOpponentName(null); // Очищаем имя оппонента
        // Возможно, также сбросить board, currentPlayer и т.д.
      });

      // Событие: отключение от сервера (по любой причине)
      socket.on("disconnect", (reason) => {
         console.log("Disconnected from server:", reason);
         // Сброс состояний при отключении
         setOnlineMode(false); // Выходим из онлайн режима
         setSocket(null); // Очищаем сокет
         setOpponentName(null); // Сбрасываем оппонента
         setGameState([ // Сбрасываем доску
            [null, null, null],
            [null, null, null],
            [null, null, null],
         ]);
         setCurrentPlayer('circle'); // Сбрасываем текущего игрока
         setPlayingAs(null); // Сбрасываем назначенную сторону
         setFinishedState(null); // Сбрасываем результат игры
         setFinishedArrayState([]); // Сбрасываем выигрышную линию
         // Имя игрока оставляем, чтобы не вводить заново
      });


      // --- Функция очистки (срабатывает при размонтировании или изменении зависимостей) ---
      return () => {
        console.log("Cleaning up socket listeners and disconnecting...");
        // Удаляем все слушатели, чтобы избежать их дублирования
        socket.off("connect");
        socket.off("opponentFound");
        socket.off("updateGameState");
        socket.off("gameFinished");
        socket.off("draw");
        socket.off("opponentLeft");
        socket.off("disconnect");

        // Отключаем сокет, если он еще подключен
        // Проверяем socket.connected, чтобы избежать ошибки, если он уже отключен
        if (socket.connected) {
             socket.disconnect();
        }
        // Важно: не вызываем setSocket(null) здесь, если хотим, чтобы состояние сбрасывалось
        // только при *фактическом* отключении, которое обрабатывается в socket.on("disconnect").
        // Если вы хотите сбросить состояние сокета при любом ре-рендере useEffect
        // (которое нежелательно), тогда можно было бы вызвать setSocket(null).
      };
    }

    // Если socket === null (например, при первом рендере или после отключения),
    // useEffect не добавляет слушателей и не возвращает функцию очистки socket.off/disconnect.
    // Это нормально.
  }, [socket, onlineMode, playerName]); // Зависимости: переподключаем эффект при изменении сокета, режима или имени игрока

  // --- Обработчик для кнопки "Играть онлайн" ---
  const handlePlayOnline = () => {
    // Проверяем, введено ли имя игрока
    if (!playerName.trim()) {
      alert("Пожалуйста, введите ваше имя игрока.");
      return;
    }
    // Устанавливаем режим онлайн. Это запустит useEffect, который попробует подключиться.
    setOnlineMode(true);

    // Если сокет уже существует и подключен (например, после разрыва соединения и попытки переподключения),
    // явно отправляем запрос на игру. В противном случае, запрос отправится в socket.on("connect").
    if (socket && socket.connected) {
         socket.emit("request_to_play", { playerName: playerName });
    }
  };

    // --- Вспомогательная функция для безопасного отображения имени оппонента ---
    // Учитывает, что opponentName может быть строкой или объектом { playerName: string }
    const displayOpponentName = (opp) => {
       if (!opp) return "Соперник"; // Текст по умолчанию, если оппонента еще нет
       if (typeof opp === 'object' && opp !== null && opp.playerName !== undefined) {
          return opp.playerName; // Если это объект со свойством playerName
       }
       return opp; // В противном случае предполагаем, что это просто строка
    };


  // --- Логика рендеринга доски ---
  const renderBoard = () => {
     // Проверяем, что gameState инициализировано и имеет правильную структуру
     if (!Array.isArray(gameState) || gameState.length !== 3 || !Array.isArray(gameState[0]) || gameState[0].length !== 3) {
         console.error("Invalid gameState structure:", gameState);
         return null; // Или отобразить сообщение об ошибке
     }

     return gameState.map((row, rowIndex) => (
        // Оборачиваем каждую строку квадратов в div, если нужно (для CSS грида/флекса)
        // <div key={rowIndex} className="board-row">
           row.map((element, colIndex) => {
              const id = rowIndex * 3 + colIndex; // Уникальный ID для каждого квадрата (0-8)
              return (
                 <Square
                    key={id} // Ключ важен при рендеринге списков
                    id={id} // Передаем ID квадрата
                    socket={socket} // Сокет для отправки ходов
                    playingAs={playingAs} // За кого играет текущий клиент
                    currentPlayer={currentPlayer} // Чей сейчас ход
                    setCurrentPlayer={setCurrentPlayer} // Функция для смены текущего игрока (после локального обновления)
                    gameState={gameState} // Общее состояние доски (нужно для setGameState в Square)
                    setGameState={setGameState} // Функция для обновления общего состояния доски
                    currentElement={element} // Значение конкретного квадрата (null, 'circle', или 'cross')
                    finishedState={finishedState} // Состояние завершения игры
                    finishedArrayState={finishedArrayState} // Массив выигрышной линии
                    // setFinishedState не используется в Square, поэтому не передаем его
                 />
              );
           })
         // </div> // Если используется обертка
      ));
  };


  // --- JSX для отображения UI ---
  return (
    <div className="app-container"> {/* Основной контейнер для стилей */}

      {/* Экран 1: Ввод имени и кнопка "Играть онлайн" */}
      {!onlineMode && (
        <div className="main-div initial-screen">
           <h1>Крестики-Нолики</h1>
           <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Введите ваше имя"
              className="player-name-input"
              disabled={onlineMode} // Отключаем ввод после перехода в онлайн режим
           />
           <button
             onClick={handlePlayOnline}
             className="playOnline"
             disabled={!playerName.trim()} // Отключаем кнопку, если имя пустое
           >
             Играть онлайн
           </button>
        </div>
      )}

      {/* Экран 2: Ожидание соперника */}
      {onlineMode && !opponentName && !finishedState && (
        <div className="main-div waiting">
          <p>Ожидание соперника...</p>
          {/* Можно добавить кнопку "Отмена" */}
          {/* <button onClick={handleCancelWait}>Отмена</button> */}
        </div>
      )}

      {/* Экран 3: Игра (активна или завершена) */}
      {onlineMode && opponentName && ( // Показываем игровой UI только если в онлайн режиме и найден оппонент
        <div className="main-div game-screen">
          <h1 className="game-heading water-background">Крестики-Нолики</h1>

          {/* Информация об игроках и индикатор хода */}
          <div className="move-detection">
            <div className={`player-info left ${currentPlayer === playingAs ? "current-move-"+playingAs : ""}`}>
              {playerName} ({playingAs === 'circle' ? 'O' : 'X'})
            </div>
            <div className={`player-info right ${currentPlayer !== playingAs ? "current-move-"+playingAs : ""}`}>
              {displayOpponentName(opponentName)} ({playingAs === 'circle' ? 'X' : 'O'}) {/* Используем вспомогательную функцию */}
            </div>
          </div>

          {/* Игровая доска */}
          <div className="square-wrapper">
             {renderBoard()} {/* Рендерим квадраты */}
          </div>

          {/* Сообщения о результате игры */}
          {finishedState && finishedState !== "opponentLeftMatch" && finishedState !== "draw" && (
            <h3 className={`finished-state ${finishedState === playingAs ? 'win-message' : 'lose-message'}`}>
               {finishedState === playingAs ? "Вы " : displayOpponentName(opponentName) + " "} победили! {/* Используем имя оппонента */}
            </h3>
          )}
          {finishedState === "draw" && (
            <h3 className="finished-state draw-message">Ничья!</h3>
          )}
          {finishedState === "opponentLeftMatch" && (
            <h3 className="finished-state win-message">Вы победили, соперник покинул игру</h3>
          )}

          {/* Сообщение "Вы играете против..." (показывается только пока игра не завершена) */}
          {!finishedState && (
            <div>
             <h2 className="opponent-message">Вы играете против {displayOpponentName(opponentName)}</h2> 
             {/* Используем имя оппонента */}
             </div>
          )}

           {/* Кнопка "Сыграть еще раз" может быть добавлена здесь, если finishedState установлен */}
           {/* {finishedState && (
               <button onClick={handlePlayAgain}>Сыграть еще раз</button>
           )} */}

        </div>
      )}

       {/* Можно добавить обработку ошибок подключения или других состояний */}

    </div>
  );
};

export default App;