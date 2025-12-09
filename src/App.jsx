// App.jsx (Firebase-ready, fixed Game 2 bug, live sync enabled)
import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

function calculateCourseHandicap(index, slope, rating) {
  return Math.round(index * (slope / 113) + (rating - 72));
}

function App() {
  const [games, setGames] = useState(Array(8).fill(null));
  const [activeGameIndex, setActiveGameIndex] = useState(0);

  useEffect(() => {
    const unsubscribers = games.map((_, i) => {
      const docRef = doc(db, 'games', `game${i + 1}`);
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setGames((prev) => {
            const updated = [...prev];
            updated[i] = docSnap.data();
            return updated;
          });
        }
      });
    });
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const updateGame = async (index, gameData) => {
    const docRef = doc(db, 'games', `game${index + 1}`);
    await setDoc(docRef, gameData);
  };

  const startGame = (index) => {
    const game = games[index];
    if (!game.redName || !game.blueName) return;

    const chRed = calculateCourseHandicap(game.redIndex, game.slope, game.rating);
    const chBlue = calculateCourseHandicap(game.blueIndex, game.slope, game.rating);
    const shotsGiven = Math.abs(chRed - chBlue);
    const shotsTo = chRed > chBlue ? 'Blue' : 'Red';
    const newGame = {
      ...game,
      chRed,
      chBlue,
      shotsGiven,
      shotsTo,
      holes: Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4, si: i + 1, red: 0, blue: 0 }))
    };
    updateGame(index, newGame);
  };

  const updateHole = (holeIndex, team, delta) => {
    const game = games[activeGameIndex];
    if (!game || !game.holes) return;
    const holes = [...game.holes];
    holes[holeIndex][team] = Math.max(0, holes[holeIndex][team] + delta);
    updateGame(activeGameIndex, { ...game, holes });
  };

  const calculateResult = (hole) => {
    const { red, blue, si } = hole;
    const game = games[activeGameIndex];
    if (!game) return '-';
    let redScore = red;
    let blueScore = blue;
    const strokeHoles = Array.from({ length: game.shotsGiven }, (_, i) => i + 1);
    if (strokeHoles.includes(si)) {
      if (game.shotsTo === 'Red') redScore--;
      else blueScore--;
    }
    if (redScore < blueScore) return game.redName;
    if (blueScore < redScore) return game.blueName;
    return 'Half';
  };

  const computeMatchStatus = (game) => {
    if (!game || !game.holes) return 'All Square';
    let redUp = 0, blueUp = 0;
    let remaining = 18;
    for (let i = 0; i < 18; i++) {
      const hole = game.holes[i];
      const result = calculateResult(hole);
      if (result === game.redName) redUp++;
      else if (result === game.blueName) blueUp++;
      const diff = Math.abs(redUp - blueUp);
      remaining--;
      if (diff > remaining) {
        const winner = redUp > blueUp ? game.redName : game.blueName;
        return `${winner} ${diff}&${remaining + 1}`;
      }
    }
    const diff = redUp - blueUp;
    if (diff > 0) return `${game.redName} ${diff} Up`;
    if (diff < 0) return `${game.blueName} ${-diff} Up`;
    return 'All Square';
  };

  const resetHoles = () => {
    const updated = [...games];
    const game = updated[activeGameIndex];
    if (!game) return;
    game.holes = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4, si: i + 1, red: 0, blue: 0 }));
    updateGame(activeGameIndex, game);
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...games];
    const game = updated[index] || { redName: '', blueName: '', redIndex: 10, blueIndex: 10, rating: 72, slope: 113 };
    game[field] = value;
    updated[index] = game;
    setGames(updated);
  };

  const activeGame = games[activeGameIndex];

  return (
    <div className="app-container">
      <h1>Golf Matchplay Tracker</h1>
      <div className="game-tabs">
        {games.map((g, i) => (
          <button
            key={i}
            onClick={() => setActiveGameIndex(i)}
            className={i === activeGameIndex ? 'active' : ''}
          >
            {g?.redName && g?.blueName ? `${g.redName} vs ${g.blueName} (${computeMatchStatus(g)})` : `Game ${i + 1}`}
          </button>
        ))}
      </div>
      {games.map((game, i) => (
        <div key={i} className="game-setup">
          Game {i + 1}: <input value={game?.redName || ''} onChange={e => handleInputChange(i, 'redName', e.target.value)} /> vs <input value={game?.blueName || ''} onChange={e => handleInputChange(i, 'blueName', e.target.value)} />
          <input value={game?.redIndex || 10} type="number" onChange={e => handleInputChange(i, 'redIndex', +e.target.value)} />
          <input value={game?.blueIndex || 10} type="number" onChange={e => handleInputChange(i, 'blueIndex', +e.target.value)} />
          <input value={game?.rating || 72} type="number" onChange={e => handleInputChange(i, 'rating', +e.target.value)} />
          <input value={game?.slope || 113} type="number" onChange={e => handleInputChange(i, 'slope', +e.target.value)} />
          <button onClick={() => startGame(i)}>Start</button>
        </div>
      ))}

      {activeGame && activeGame.holes && (
        <div>
          <h2>{activeGame.redName} vs {activeGame.blueName}</h2>
          <p>{activeGame.redName} CH: {activeGame.chRed}, {activeGame.blueName} CH: {activeGame.chBlue}</p>
          <button onClick={resetHoles}>Reset Scores</button>
          <table>
            <thead>
              <tr><th>Hole</th><th>Par</th><th>SI</th><th>{activeGame.redName}</th><th>{activeGame.blueName}</th><th>Result</th></tr>
            </thead>
            <tbody>
              {activeGame.holes.map((hole, i) => (
                <tr key={i}>
                  <td>{hole.hole}</td>
                  <td><input value={hole.par} onChange={e => {
                    const updated = [...activeGame.holes];
                    updated[i].par = +e.target.value;
                    updateGame(activeGameIndex, { ...activeGame, holes: updated });
                  }} /></td>
                  <td><input value={hole.si} onChange={e => {
                    const updated = [...activeGame.holes];
                    updated[i].si = +e.target.value;
                    updateGame(activeGameIndex, { ...activeGame, holes: updated });
                  }} /></td>
                  <td><button onClick={() => updateHole(i, 'red', -1)}>-</button>{hole.red}<button onClick={() => updateHole(i, 'red', 1)}>+</button></td>
                  <td><button onClick={() => updateHole(i, 'blue', -1)}>-</button>{hole.blue}<button onClick={() => updateHole(i, 'blue', 1)}>+</button></td>
                  <td>{calculateResult(hole)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
