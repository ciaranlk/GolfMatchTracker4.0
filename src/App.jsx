import React, { useState, useEffect } from 'react';
import './App.css';

function calculateCourseHandicap(index, slope, rating) {
  return Math.round(index * (slope / 113) + (rating - 72));
}

function App() {
  const emptyGames = Array.from({ length: 8 }, () => null);
  const [games, setGames] = useState(() => {
    const saved = localStorage.getItem('games');
    return saved ? JSON.parse(saved) : emptyGames;
  });
  const [activeGameIndex, setActiveGameIndex] = useState(0);

  useEffect(() => {
    localStorage.setItem('games', JSON.stringify(games));
  }, [games]);

  const updateGameField = (index, field, value) => {
    const updatedGames = [...games];
    updatedGames[index] = {
      ...updatedGames[index],
      [field]: value,
    };
    setGames(updatedGames);
  };

  const startGame = (index) => {
    const g = games[index];
    const chRed = calculateCourseHandicap(g.redIndex, g.slope, g.rating);
    const chBlue = calculateCourseHandicap(g.blueIndex, g.slope, g.rating);
    const shotsGiven = Math.abs(chRed - chBlue);
    const shotsTo = chRed > chBlue ? 'blue' : 'red';
    const newGame = {
      ...g,
      chRed,
      chBlue,
      shotsGiven,
      shotsTo,
      holes: Array.from({ length: 18 }, (_, i) => ({
        hole: i + 1,
        par: 4,
        si: i + 1,
        red: 0,
        blue: 0
      })),
    };
    const updatedGames = [...games];
    updatedGames[index] = newGame;
    setGames(updatedGames);
    setActiveGameIndex(index);
  };

  const updateHole = (index, team, delta) => {
    const updated = [...games];
    const game = updated[activeGameIndex];
    const score = game.holes[index][team] + delta;
    game.holes[index][team] = score < 0 ? 0 : score;
    setGames(updated);
  };

  const calculateResult = (hole, game) => {
    if (!hole) return '-';
    const { red, blue, si } = hole;
    const { shotsGiven, shotsTo } = game;
    const strokeHoles = Array.from({ length: shotsGiven }, (_, i) => i + 1);
    const applyShot = strokeHoles.includes(si);
    let redScore = red;
    let blueScore = blue;
    if (applyShot) {
      if (shotsTo === 'red') redScore--;
      else blueScore--;
    }
    if (redScore < blueScore) return game.redName;
    if (blueScore < redScore) return game.blueName;
    return 'Half';
  };

  const computeMatchStatus = (game) => {
    if (!game || !game.holes) return 'All Square';
    let redUp = 0;
    let blueUp = 0;
    let remaining = 18;
    game.holes.forEach(hole => {
      const result = calculateResult(hole, game);
      if (result === game.redName) redUp++;
      else if (result === game.blueName) blueUp++;
      remaining--;
    });
    const diff = redUp - blueUp;
    if (diff > 0 && diff > remaining) return `${game.redName} ${diff}&${remaining}`;
    if (diff < 0 && -diff > remaining) return `${game.blueName} ${-diff}&${remaining}`;
    if (diff > 0) return `${game.redName} ${diff} Up`;
    if (diff < 0) return `${game.blueName} ${-diff} Up`;
    return 'All Square';
  };

  const resetScores = () => {
    const reset = games.map(g => {
      if (!g || !g.holes) return g;
      return {
        ...g,
        holes: g.holes.map(h => ({ ...h, red: 0, blue: 0 }))
      };
    });
    setGames(reset);
  };

  const exportJSON = () => {
    const data = JSON.stringify(games, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'match_data.json';
    link.click();
  };

  const currentGame = games[activeGameIndex];

  return (
    <div className="app-container">
      <h1>Golf Matchplay Tracker</h1>

      <div className="game-buttons">
        {games.map((g, i) => (
          <button key={i} onClick={() => setActiveGameIndex(i)}>
            {g?.redName || 'Red'} vs {g?.blueName || 'Blue'} ({computeMatchStatus(g)})
          </button>
        ))}
      </div>

      <div className="setup-section">
        {games.map((g, i) => (
          <div key={i}>
            <strong>Game {i + 1}</strong>{' '}
            <input
              placeholder="Red"
              value={g?.redName || ''}
              onChange={e => updateGameField(i, 'redName', e.target.value)}
            />{' '}
            <input
              placeholder="Blue"
              value={g?.blueName || ''}
              onChange={e => updateGameField(i, 'blueName', e.target.value)}
            />{' '}
            <input
              type="number"
              placeholder="Red Index"
              value={g?.redIndex || ''}
              onChange={e => updateGameField(i, 'redIndex', +e.target.value)}
            />{' '}
            <input
              type="number"
              placeholder="Blue Index"
              value={g?.blueIndex || ''}
              onChange={e => updateGameField(i, 'blueIndex', +e.target.value)}
            />{' '}
            <input
              type="number"
              placeholder="Rating"
              value={g?.rating || ''}
              onChange={e => updateGameField(i, 'rating', +e.target.value)}
            />{' '}
            <input
              type="number"
              placeholder="Slope"
              value={g?.slope || ''}
              onChange={e => updateGameField(i, 'slope', +e.target.value)}
            />{' '}
            <button onClick={() => startGame(i)}>Start</button>
          </div>
        ))}
      </div>

      <hr />

      {currentGame && currentGame.holes && (
        <div>
          <h3>{currentGame.redName} vs {currentGame.blueName}</h3>
          <p>{currentGame.redName} CH: {currentGame.chRed}, {currentGame.blueName} CH: {currentGame.chBlue}</p>

          <table>
            <thead>
              <tr>
                <th>Hole</th><th>Par</th><th>SI</th>
                <th>{currentGame.redName}</th>
                <th>{currentGame.blueName}</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {currentGame.holes.map((hole, i) => (
                <tr key={i}>
                  <td>{hole.hole}</td>
                  <td><input value={hole.par} onChange={e => {
                    const updated = [...games];
                    updated[activeGameIndex].holes[i].par = +e.target.value;
                    setGames(updated);
                  }} /></td>
                  <td><input value={hole.si} onChange={e => {
                    const updated = [...games];
                    updated[activeGameIndex].holes[i].si = +e.target.value;
                    setGames(updated);
                  }} /></td>
                  <td>
                    <button onClick={() => updateHole(i, 'red', -1)}>-</button>
                    {hole.red}
                    <button onClick={() => updateHole(i, 'red', 1)}>+</button>
                  </td>
                  <td>
                    <button onClick={() => updateHole(i, 'blue', -1)}>-</button>
                    {hole.blue}
                    <button onClick={() => updateHole(i, 'blue', 1)}>+</button>
                  </td>
                  <td>{calculateResult(hole, currentGame)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="action-buttons">
            <button onClick={resetScores}>Reset Scores</button>
            <button onClick={exportJSON}>Export JSON</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
