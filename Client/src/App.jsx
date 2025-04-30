import React, { useState, useEffect } from "react";
import "./App.css";
import Square from "./Square/Square";
import { io } from "socket.io-client";
import Swal from "sweetalert2";

const initialGameState = [
  [null, null, null],
  [null, null, null],
  [null, null, null]
];

const App = () => {
  const [gameState, setGameState] = useState(initialGameState);
  const [currentPlayer, setCurrentPlayer] = useState("cross");
  const [finishedState, setFinishedState] = useState(null);
  const [playOnline, setPlayOnline] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [playingAs, setPlayingAs] = useState(null);
  const [status, setStatus] = useState("disconnected");

  const checkWinner = () => {
    // Проверка строк и столбцов
    for (let i = 0; i < 3; i++) {
      // Проверка строк
      if (gameState[i][0] && gameState[i][0] === gameState[i][1] && gameState[i][1] === gameState[i][2]) {
        return gameState[i][0];
      }
      // Проверка столбцов
      if (gameState[0][i] && gameState[0][i] === gameState[1][i] && gameState[1][i] === gameState[2][i]) {
        return gameState[0][i];
      }
    }

    // Проверка диагоналей
    if (gameState[0][0] && gameState[0][0] === gameState[1][1] && gameState[1][1] === gameState[2][2]) {
      return gameState[0][0];
    }
    if (gameState[0][2] && gameState[0][2] === gameState[1][1] && gameState[1][1] === gameState[2][0]) {
      return gameState[0][2];
    }

    // Проверка на ничью
    if (gameState.flat().every(cell => cell !== null)) {
      return "draw";
    }

    return null;
  };

  useEffect(() => {
    const winner = checkWinner();
    if (winner) {
      setFinishedState(winner);
      if (socket && winner !== "draw") {
        socket.emit("game_over", { winner });
      }
    }
  }, [gameState]);

  const takePlayerName = async () => {
    const result = await Swal.fire({
      title: "Введите ваше имя",
      input: "text",
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return "Пожалуйста, введите имя!";
      }
    });

    if (result.isConfirmed) {
      return result.value;
    }
    return null;
  };

  const handleSquareClick = (rowIndex, colIndex) => {
    if (finishedState || gameState[rowIndex][colIndex] || currentPlayer !== playingAs) return;

    const newGameState = [...gameState];
    newGameState[rowIndex][colIndex] = playingAs;
    setGameState(newGameState);

    if (socket) {
      socket.emit("make_move", {
        row: rowIndex,
        col: colIndex,
        symbol: playingAs
      });
    }

    setCurrentPlayer(playingAs === "cross" ? "circle" : "cross");
  };

  const handlePlayOnline = async () => {
    const name = await takePlayerName();
    if (!name) return;

    setPlayerName(name);
    
    const newSocket = io(); // или

    newSocket.on("connect", () => {
      setPlayOnline(true);
      setStatus("connected");
      newSocket.emit("request_to_play", { playerName: name });
    });

    newSocket.on("opponent_found", (data) => {
      setOpponentName(data.opponentName);
      setPlayingAs(data.symbol);
      setStatus("playing");
    });

    newSocket.on("opponent_move", ({ row, col }) => {
      setGameState(prev => {
        const newState = [...prev];
        newState[row][col] = playingAs === "cross" ? "circle" : "cross";
        return newState;
      });
      setCurrentPlayer(playingAs);
    });

    newSocket.on("opponent_left", () => {
      setFinishedState("opponentLeftMatch");
      setStatus("disconnected");
    });

    newSocket.on("disconnect", () => {
      setStatus("disconnected");
    });

    newSocket.on("connect_error", (err) => {
      console.error("Ошибка подключения:", err);
      Swal.fire("Ошибка", "Не удалось подключиться к серверу", "error");
    });

    setSocket(newSocket);
  };

  const resetGame = () => {
    setGameState(initialGameState);
    setFinishedState(null);
    setCurrentPlayer("cross");
    if (socket) {
      socket.emit("request_to_play", { playerName });
      setStatus("waiting");
    }
  };

  if (!playOnline) {
    return (
      <div className="main-div">
        <button onClick={handlePlayOnline} className="playOnline">
          Играть онлайн
        </button>
      </div>
    );
  }

  return (
    <div className="main-div">
      <div className="move-detection">
        <div className={`left ${currentPlayer === "cross" ? "active" : ""}`}>
          {playerName} (X)
        </div>
        <div className={`right ${currentPlayer === "circle" ? "active" : ""}`}>
          {opponentName || "Ожидание..."} (O)
        </div>
      </div>
      
      <h1 className="game-heading">Крестики-Нолики</h1>
      
      {status === "waiting" && (
        <div className="waiting">
          <p>Поиск соперника...</p>
        </div>
      )}

      {status === "playing" && (
        <div className="board">
          {gameState.map((row, rowIndex) => (
            <div key={rowIndex} className="board-row">
              {row.map((cell, colIndex) => (
                <Square
                  key={`${rowIndex}-${colIndex}`}
                  value={cell}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                  disabled={finishedState || cell !== null || currentPlayer !== playingAs}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {finishedState === "opponentLeftMatch" && (
        <div className="game-over">
          <h2>Соперник покинул игру</h2>
          <button onClick={resetGame}>Играть снова</button>
        </div>
      )}

      {finishedState === "draw" && (
        <div className="game-over">
          <h2>Ничья!</h2>
          <button onClick={resetGame}>Играть снова</button>
        </div>
      )}

      {finishedState && finishedState !== "draw" && finishedState !== "opponentLeftMatch" && (
        <div className="game-over">
          <h2>{finishedState === playingAs ? "Вы победили!" : "Вы проиграли!"}</h2>
          <button onClick={resetGame}>Играть снова</button>
        </div>
      )}
    </div>
  );
};

export default App;