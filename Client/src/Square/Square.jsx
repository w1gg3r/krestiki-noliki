import React from "react"; // useState больше не нужен
import "./Square.css";

// Используем camelCase для атрибутов SVG
const circleSvg = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      strokeLinecap="round"
      strokeLinejoin="round"
    ></g>
    <g id="SVGRepo_iconCarrier">
      <path
        d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </g>
  </svg>
);

// Используем camelCase для атрибутов SVG
const crossSvg = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      strokeLinecap="round"
      strokeLinejoin="round"
    ></g>
    <g id="SVGRepo_iconCarrier">
      <path
        d="M19 5L5 19M5.00001 5L19 19"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </g>
  </svg>
);

const Square = ({
  // gameState, // Проп gameState используется не напрямую, а через setGameState, можно оставить или удалить, если не нужен для других целей
  setGameState,
  socket,
  playingAs, // За кого играет этот клиент ('circle' или 'cross')
  currentElement, // Содержимое этого квадрата ('circle', 'cross' или null) - ИСТОЧНИК ИСТИНЫ
  finishedArrayState, // Массив ID квадратов выигрышной линии
  // setFinishedState, // Этот проп не используется в компоненте
  finishedState, // Состояние завершения игры ('circle', 'cross' или null)
  id, // ID этого квадрата (0-8)
  currentPlayer, // Чей сейчас ход ('circle' или 'cross')
  setCurrentPlayer,
}) => {
  // Удалено локальное состояние icon - currentElement является источником истины

  const clickOnSquare = () => {
    // Запрещаем клик, если:
    // 1. Сейчас не ход этого игрока (playingAs !== currentPlayer)
    // 2. Игра уже завершена (finishedState)
    // 3. Квадрат уже занят (currentElement не null)
    if (playingAs !== currentPlayer || finishedState || currentElement) {
      return;
    }

    // Сохраняем текущего игрока перед обновлением состояния
    const myCurrentPlayer = currentPlayer;

    // Отправляем ход на сервер
    socket.emit("playerMoveFromClient", {
      state: {
        id,
        sign: myCurrentPlayer,
      },
    });

    // Обновляем общее состояние игры для этого квадрата
    setGameState((prevState) => {
      const newState = [...prevState]; // Создаем копию состояния
      const rowIndex = Math.floor(id / 3);
      const colIndex = id % 3;
      newState[rowIndex][colIndex] = myCurrentPlayer; // Обновляем соответствующий квадрат
      return newState;
    });

    // Переключаем текущего игрока
    setCurrentPlayer(currentPlayer === "circle" ? "cross" : "circle");
  };

  // Определяем, какую иконку отобразить, основываясь ТОЛЬКО на currentElement
  const renderedIcon =
    currentElement === "circle"
      ? circleSvg
      : currentElement === "cross"
      ? crossSvg
      : null; // Если currentElement null, не отображаем ничего

  // Определяем CSS классы
  const classes = [
    'square', // Основной класс
    // Класс 'not-allowed' добавляется, если: игра окончена, не ход этого игрока, или квадрат занят
    (finishedState || currentPlayer !== playingAs || currentElement) ? 'not-allowed' : '',
    // Класс для выигрышной линии: добавляется, если игра окончена И этот квадрат входит в выигрышную линию
    (finishedState && finishedArrayState.includes(id)) ? finishedState + '-won' : '',
    // Класс для затемнения: добавляется, если игра окончена И этот игрок не выиграл
    (finishedState && finishedState !== playingAs) ? 'grey-background' : '',
  ].filter(Boolean).join(' '); // Фильтруем пустые строки и объединяем

  return (
    <div
      onClick={clickOnSquare}
      className={classes} // Используем вычисленные классы
    >
      {renderedIcon} {/* Отображаем определенную иконку */}
    </div>
  );
};

export default Square;