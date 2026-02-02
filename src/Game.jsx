import React, { useState, useEffect, useCallback } from 'react';

const CW = 60, CH = 40, VW = 17, VH = 15;
const WIND_DIRS = [{dx:1,dy:0,name:'→'},{dx:-1,dy:0,name:'←'},{dx:0,dy:1,name:'↓'},{dx:0,dy:-1,name:'↑'}];

const MONSTERS = {
  lizard: { name: 'Gigasaur', emoji: '🦖', hp: 10, speed: 1, hunger: 20, ranged: 3, desc: 'Fire breath (SPACE)' },
  ape: { name: 'Megapex', emoji: '🦍', hp: 8, speed: 2, hunger: 18, ranged: 0, desc: 'Fast, can throw' },
  blob: { name: 'The Ooze', emoji: '🟢', hp: 18, speed: 1, hunger: 25, ranged: 0, desc: 'Regenerates, fire trail' }
};

const genCity = () => {
  const grid = Array(CH).fill(null).map(() => Array(CW).fill(null));

  // Deep water edges
  for (let y = 0; y < CH; y++) {
    for (let x = CW - 4; x < CW; x++) {
      if (x >= CW - 2) grid[y][x] = { type: 'deepwater' };
      else if (Math.random() < 0.5) grid[y][x] = { type: 'deepwater' };
    }
  }
  // River through city
  const riverY = 15 + Math.floor(Math.random() * 10);
  for (let x = 0; x < CW - 4; x++) {
    grid[riverY][x] = { type: 'shallowwater' };
    if (Math.random() < 0.3 && riverY + 1 < CH) grid[riverY + 1][x] = { type: 'shallowwater' };
  }

  // Bridges over river
  const bridgeSpots = [10, 25, 40];
  bridgeSpots.forEach(bx => {
    if (bx < CW - 4) {
      grid[riverY][bx] = { type: 'bridge' };
      if (grid[riverY + 1]?.[bx]?.type === 'shallowwater') grid[riverY + 1][bx] = { type: 'bridge' };
    }
  });

  // Roads
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      if (grid[y][x]) continue;
      if (y % 4 === 0 || x % 5 === 0) grid[y][x] = { type: 'road' };
    }
  }

  // Special buildings
  const place = (type, hp, count, zone) => {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = zone.x + Math.floor(Math.random() * zone.w);
        const y = zone.y + Math.floor(Math.random() * zone.h);
        if (y >= 0 && y < CH && x >= 0 && x < CW && (!grid[y][x] || grid[y][x].type === 'road')) {
          grid[y][x] = { type, hp, maxHp: hp };
          break;
        }
      }
    }
  };

  place('milbase', 8, 1, { x: 20, y: 10, w: 20, h: 20 });
  place('cityhall', 6, 1, { x: 25, y: 15, w: 10, h: 10 });
  place('lab', 4, 1, { x: 10, y: 5, w: 40, h: 30 });
  place('powerplant', 6, 2, { x: 5, y: 5, w: 45, h: 30 });
  place('police', 4, 4, { x: 5, y: 5, w: 50, h: 30 });

  // Parks
  const parkSpots = [[8, 8], [35, 12], [20, 28], [45, 25]];
  parkSpots.forEach(([px, py]) => {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const y = py + dy, x = px + dx;
        if (y < CH && x < CW && (!grid[y][x] || grid[y][x].type === 'road')) {
          grid[y][x] = { type: 'park' };
        }
      }
    }
  });

  // Buildings
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      if (grid[y][x]) continue;
      const d = Math.abs(x - CW / 2) + Math.abs(y - CH / 2);
      const chance = d < 12 ? 0.85 : d < 25 ? 0.6 : 0.35;
      if (Math.random() < chance) {
        let hp, size;
        if (d < 10) { hp = 4 + Math.floor(Math.random() * 3); size = 'large'; }
        else if (d < 20) { hp = 2 + Math.floor(Math.random() * 3); size = 'medium'; }
        else { hp = 1 + Math.floor(Math.random() * 2); size = 'small'; }
        grid[y][x] = { type: 'building', hp, maxHp: hp, size };
      } else {
        grid[y][x] = { type: 'road' };
      }
    }
  }

  // Monster spawn
  const spawnY = Math.floor(CH / 2);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = 0; dx <= 2; dx++) {
      const ny = spawnY + dy;
      if (ny >= 0 && ny < CH) grid[ny][dx] = { type: 'road' };
    }
  }

  // Find milbase position
  let basePos = { x: 30, y: 20 };
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      if (grid[y][x]?.type === 'milbase') basePos = { x, y };
    }
  }

  return { grid, basePos, baseAlive: true };
};

const initGame = (monsterType) => {
  const m = MONSTERS[monsterType];
  const city = genCity();
  return {
    grid: city.grid,
    basePos: city.basePos,
    baseAlive: city.baseAlive,
    monster: { x: 1, y: Math.floor(CH / 2), hp: m.hp, maxHp: m.hp, hunger: 0, maxHunger: m.hunger, type: monsterType, movesLeft: m.speed, carrying: null, lastDir: [1, 0] },
    enemies: [],
    civilians: [],
    fires: [],
    wind: WIND_DIRS[Math.floor(Math.random() * 4)],
    turn: 0,
    message: `${m.name} emerges! Wind blowing ${WIND_DIRS[0].name}`,
    gameOver: false,
    score: 0,
    damageFlash: 0,
    log: [],
    berserk: false
  };
};

const addLog = (log, msg, type = 'info') => [...log.slice(-19), { msg, type, id: Date.now() + Math.random() }];

export default function Game() {
  const [screen, setScreen] = useState('title');
  const [game, setGame] = useState(null);
  const [zoom, setZoom] = useState(28);

  const startGame = (type) => { setGame(initGame(type)); setScreen('game'); };

  const spreadFire = useCallback((g) => {
    const newGrid = g.grid.map(r => r.map(c => c ? { ...c } : c));
    let newFires = [...g.fires];
    let log = [...g.log];

    // Existing fires spread
    const toSpread = [];
    newFires.forEach(f => {
      f.life--;
      if (f.life <= 0) return;
      // Spread in wind direction
      if (Math.random() < 0.4) {
        const nx = f.x + g.wind.dx;
        const ny = f.y + g.wind.dy;
        if (nx >= 0 && nx < CW && ny >= 0 && ny < CH) {
          const cell = newGrid[ny][nx];
          if (cell && ['building', 'park'].includes(cell.type)) {
            toSpread.push({ x: nx, y: ny, life: 3 });
          }
        }
      }
    });

    // Apply fire damage
    newFires = newFires.filter(f => f.life > 0);
    newFires.forEach(f => {
      const cell = newGrid[f.y][f.x];
      if (cell && cell.hp) {
        cell.hp -= 1;
        if (cell.hp <= 0) {
          const wasType = cell.type;
          newGrid[f.y][f.x] = { type: 'rubble' };
          if (wasType === 'building') log = addLog(log, 'Building burned down!', 'info');
        }
      }
    });

    // Add new fires
    toSpread.forEach(f => {
      if (!newFires.some(ef => ef.x === f.x && ef.y === f.y)) {
        newFires.push(f);
      }
    });

    return { newGrid, newFires, log };
  }, []);

  const endTurn = useCallback((g) => {
    const m = MONSTERS[g.monster.type];
    const newMonster = { ...g.monster, movesLeft: m.speed };
    let { newGrid, newFires, log } = spreadFire(g);
    let msg = "";
    let dmgFlash = 0;
    let baseAlive = g.baseAlive;
    let berserk = g.berserk;

    // Hunger
    newMonster.hunger = Math.min(newMonster.maxHunger, newMonster.hunger + 1);

    // Check berserk
    if (newMonster.hunger > newMonster.maxHunger * 0.85 && !berserk) {
      berserk = true;
      msg = "🔥 BERSERK! Hunger takes over!";
      log = addLog(log, 'BERSERK MODE!', 'damage');
    }

    if (newMonster.hunger > newMonster.maxHunger * 0.75) {
      const starve = g.monster.type === 'blob' ? 0.25 : 0.5;
      newMonster.hp -= starve;
      if (!msg) msg = "Starving!";
      log = addLog(log, `Starving! -${starve} HP`, 'damage');
      dmgFlash = 3;
    }

    // Blob regen
    if (g.monster.type === 'blob') {
      if (newMonster.hp < newMonster.maxHp) {
        newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 0.5);
        log = addLog(log, 'Regenerated +0.5 HP', 'heal');
      }
    }

    // Spawn enemies
    const newEnemies = [...g.enemies];
    if (g.turn % 4 === 0) {
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          if (newGrid[y][x]?.type === 'police' && newEnemies.length < 15) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
            const px = x + dx, py = y + dy;
            if (px >= 0 && px < CW && py >= 0 && py < CH) {
              const cell = newGrid[py][px];
              if (!cell || cell.type === 'road' || cell.type === 'rubble')
                newEnemies.push({ x: px, y: py, type: 'police', hp: 1 });
            }
          }
        }
      }
    }

    if (g.turn % 3 === 0 && newEnemies.length < 15) {
      const count = g.turn < 10 ? 1 : g.turn < 25 ? 2 : 3;
      for (let i = 0; i < count; i++) {
        let ex, ey;
        if (baseAlive && newGrid[g.basePos.y]?.[g.basePos.x]?.type === 'milbase') {
          const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]];
          const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
          ex = g.basePos.x + dx; ey = g.basePos.y + dy;
        } else {
          baseAlive = false;
          const side = Math.floor(Math.random() * 3);
          if (side === 0) { ex = 0; ey = Math.floor(Math.random() * CH); }
          else if (side === 1) { ex = Math.floor(Math.random() * (CW - 6)); ey = 0; }
          else { ex = Math.floor(Math.random() * (CW - 6)); ey = CH - 1; }
        }
        if (ex >= 0 && ex < CW && ey >= 0 && ey < CH) {
          const r = Math.random();
          const type = r < 0.4 ? 'infantry' : r < 0.75 ? 'tank' : 'heli';
          newEnemies.push({ x: ex, y: ey, type, hp: type === 'tank' ? 2 : 1 });
        }
      }
    }

    // Ambient civilians
    let newCivs = [...g.civilians];
    if (g.turn % 2 === 0 && newCivs.length < 20) {
      const cx = Math.floor(Math.random() * CW);
      const cy = Math.floor(Math.random() * CH);
      const cell = newGrid[cy]?.[cx];
      if (cell?.type === 'road') newCivs.push({ x: cx, y: cy });
    }

    // Move civilians
    newCivs = newCivs.map(c => {
      const dx = Math.sign(c.x - newMonster.x);
      const dy = Math.sign(c.y - newMonster.y);
      let nx = c.x, ny = c.y;
      if (Math.random() < 0.6) {
        if (Math.random() < 0.5 && dx !== 0) nx = c.x + dx;
        else if (dy !== 0) ny = c.y + dy;
      }
      if (nx >= 0 && nx < CW && ny >= 0 && ny < CH) {
        const cell = newGrid[ny][nx];
        if (cell?.type === 'road' || cell?.type === 'rubble' || cell?.type === 'bridge') return { x: nx, y: ny };
      }
      return c;
    });

    // Kill civilians in fire
    newCivs = newCivs.filter(c => !newFires.some(f => f.x === c.x && f.y === c.y));

    // Move enemies and track damage by type
    const dmgByType = { police: 0, infantry: 0, tank: 0, heli: 0 };
    newEnemies.forEach(e => {
      // Fire damages enemies too
      if (newFires.some(f => f.x === e.x && f.y === e.y)) {
        e.hp -= 1;
      }

      const dx = Math.sign(newMonster.x - e.x);
      const dy = Math.sign(newMonster.y - e.y);
      const canFly = e.type === 'heli';

      for (let attempt = 0; attempt < 2; attempt++) {
        const tryX = attempt === 0 ? (Math.abs(dx) >= Math.abs(dy)) : (Math.abs(dx) < Math.abs(dy));
        let nx = e.x, ny = e.y;
        if (tryX && dx !== 0) nx = e.x + dx;
        else if (dy !== 0) ny = e.y + dy;

        if (nx >= 0 && nx < CW && ny >= 0 && ny < CH) {
          const cell = newGrid[ny][nx];
          const civBlock = !canFly && newCivs.some(c => c.x === nx && c.y === ny);
          const canPass = canFly || (!civBlock && (!cell || cell.type === 'road' || cell.type === 'rubble' || cell.type === 'bridge'));
          if (canPass) { e.x = nx; e.y = ny; break; }
        }
      }

      if (Math.abs(e.x - newMonster.x) <= 1 && Math.abs(e.y - newMonster.y) <= 1) {
        const baseDmg = e.type === 'police' ? 0.25 : e.type === 'infantry' ? 0.5 : e.type === 'tank' ? 1.5 : 0.75;
        const actualDmg = g.monster.type === 'blob' ? baseDmg * 0.6 : baseDmg;
        dmgByType[e.type] += actualDmg;
      }
    });

    // Remove dead enemies
    const survivingEnemies = newEnemies.filter(e => e.hp > 0);

    const totalDmg = Object.values(dmgByType).reduce((a, b) => a + b, 0);
    if (totalDmg > 0) {
      newMonster.hp -= totalDmg;
      msg = `Took ${totalDmg.toFixed(1)} damage!`;
      // Log breakdown by type
      const breakdown = Object.entries(dmgByType)
        .filter(([_, d]) => d > 0)
        .map(([type, d]) => `${type}: -${d.toFixed(1)}`)
        .join(', ');
      log = addLog(log, breakdown, 'damage');
      dmgFlash = 4;
    }

    // Wind shift occasionally
    let newWind = g.wind;
    if (Math.random() < 0.1) {
      newWind = WIND_DIRS[Math.floor(Math.random() * 4)];
      log = addLog(log, `Wind shifts to ${newWind.name}`, 'info');
    }

    let gameOver = false;
    if (newMonster.hp <= 0) { msg = "DESTROYED!"; gameOver = true; }
    else if (newMonster.hunger >= newMonster.maxHunger) { msg = "STARVED!"; gameOver = true; }

    return { ...g, grid: newGrid, monster: newMonster, enemies: survivingEnemies, civilians: newCivs, fires: newFires, wind: newWind, turn: g.turn + 1, message: msg || g.message, gameOver, damageFlash: dmgFlash, baseAlive, log, berserk };
  }, [spreadFire]);

  const doBerserkMove = useCallback((g) => {
    // Find nearest food
    let nearest = null;
    let minDist = Infinity;

    g.civilians.forEach(c => {
      const d = Math.abs(c.x - g.monster.x) + Math.abs(c.y - g.monster.y);
      if (d < minDist) { minDist = d; nearest = { x: c.x, y: c.y }; }
    });
    g.enemies.forEach(e => {
      const d = Math.abs(e.x - g.monster.x) + Math.abs(e.y - g.monster.y);
      if (d < minDist) { minDist = d; nearest = { x: e.x, y: e.y }; }
    });

    if (!nearest) {
      // No food - move randomly in desperation
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
      return { dx, dy };
    }

    const dx = Math.sign(nearest.x - g.monster.x);
    const dy = Math.sign(nearest.y - g.monster.y);

    return { dx, dy };
  }, []);

  const doMove = useCallback((dx, dy) => {
    if (!game || game.gameOver) return;

    setGame(g => {
      if (g.monster.movesLeft <= 0) return g;

      const nx = Math.max(0, Math.min(CW - 1, g.monster.x + dx));
      const ny = Math.max(0, Math.min(CH - 1, g.monster.y + dy));
      if (nx === g.monster.x && ny === g.monster.y) return g;

      const cell = g.grid[ny][nx];
      if (cell?.type === 'deepwater') return { ...g, message: "Too deep!" };
      if (cell?.type === 'shallowwater' && g.monster.type !== 'lizard') return { ...g, message: "Can't swim!" };

      const newGrid = g.grid.map(r => r.map(c => c ? { ...c } : c));
      const newMonster = { ...g.monster };
      const oldX = g.monster.x, oldY = g.monster.y; // Track starting position for blob fire trail
      let msg = "", score = g.score, dmgFlash = 0, baseAlive = g.baseAlive;
      let log = [...g.log];
      let newFires = [...g.fires];
      let berserk = g.berserk;

      // Power plant check - DEADLY!
      if (cell?.type === 'powerplant') {
        log = addLog(log, '💀 POWER PLANT EXPLOSION!', 'damage');
        newMonster.hp = 0;
        return { ...g, monster: newMonster, log, message: "💀 POWER PLANT EXPLOSION!", gameOver: true, damageFlash: 10 };
      }

      // Eat civilians
      let newCivs = g.civilians.filter(c => {
        if (c.x === nx && c.y === ny) {
          newMonster.hunger = Math.max(0, newMonster.hunger - 4);
          newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 0.5);
          score += 10;
          log = addLog(log, 'Ate civilian! -4🍖 +0.5HP', 'heal');
          if (berserk && newMonster.hunger < newMonster.maxHunger * 0.5) {
            berserk = false;
            log = addLog(log, 'Regained control!', 'info');
          }
          return false;
        }
        return true;
      });

      // Crush/grab enemies
      let newEnemies = g.enemies.filter(e => {
        if (e.x === nx && e.y === ny) {
          if (g.monster.type === 'ape' && !newMonster.carrying) {
            newMonster.carrying = { type: e.type, emoji: { police: '👮', infantry: '💂', tank: '🚐', heli: '🚁' }[e.type] };
            log = addLog(log, `Grabbed ${e.type}!`, 'info');
          } else {
            newMonster.hunger = Math.max(0, newMonster.hunger - 3);
            newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 1);
            score += e.type === 'tank' ? 75 : 50;
            log = addLog(log, `Crushed ${e.type}! +1HP`, 'heal');
            if (berserk && newMonster.hunger < newMonster.maxHunger * 0.5) {
              berserk = false;
              log = addLog(log, 'Regained control!', 'info');
            }
          }
          return false;
        }
        return true;
      });

      const target = newGrid[ny][nx];
      const destructible = ['building', 'milbase', 'police', 'cityhall', 'lab', 'park'].includes(target?.type);

      if (destructible) {
        const dmg = g.monster.type === 'ape' ? 2 : 1;
        target.hp = (target.hp || 1) - dmg;
        if (target.hp <= 0) {
          let civSpawn = 0;
          if (target.type === 'milbase') {
            score += 500; baseAlive = false;
            msg = "💥 MILITARY BASE DESTROYED!";
            log = addLog(log, 'Military Base down! +500', 'score');
            civSpawn = 2;
          } else if (target.type === 'police') {
            score += 200;
            msg = "🚔 POLICE STATION DOWN!";
            log = addLog(log, 'Police Station down! +200', 'score');
            civSpawn = 1;
          } else if (target.type === 'cityhall') {
            score += 1000;
            msg = "🏛️ CITY HALL DEMOLISHED!";
            log = addLog(log, 'City Hall! +1000', 'score');
            civSpawn = 3;
          } else if (target.type === 'lab') {
            score += 300;
            newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 5);
            msg = "🔬 LAB DESTROYED! +5 HP!";
            log = addLog(log, 'Lab! +300, +5HP', 'heal');
          } else if (target.type === 'park') {
            newGrid[ny][nx] = { type: 'road' };
            msg = "Trees crushed!";
            newMonster.x = nx; newMonster.y = ny;
          } else {
            score += target.maxHp * 50;
            log = addLog(log, `Building! +${target.maxHp * 50}`, 'score');
            civSpawn = target.size === 'large' ? 3 : target.size === 'medium' ? 2 : 1;
            if (Math.random() < 0.4) {
              newMonster.hunger = Math.max(0, newMonster.hunger - 2);
              newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 0.5);
              log = addLog(log, 'Snacks! -2🍖 +0.5HP', 'heal');
            }
          }
          if (target.type !== 'bridge' && target.type !== 'park') {
            newGrid[ny][nx] = { type: 'rubble' };
          }
          // Spawn fleeing civilians
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (let i = 0; i < civSpawn && Math.random() < 0.7; i++) {
            const [cdx, cdy] = dirs[Math.floor(Math.random() * 4)];
            const cx = nx + cdx, cy = ny + cdy;
            if (cx >= 0 && cx < CW && cy >= 0 && cy < CH) {
              const cc = newGrid[cy][cx];
              if (cc?.type === 'road' || cc?.type === 'rubble') newCivs.push({ x: cx, y: cy });
            }
          }
          newMonster.x = nx; newMonster.y = ny;
        } else {
          msg = `Smashing! (${target.hp}/${target.maxHp})`;
          score += 25;
        }
      } else {
        newMonster.x = nx; newMonster.y = ny;
      }

      // Fire damage to monster
      if (newFires.some(f => f.x === newMonster.x && f.y === newMonster.y)) {
        newMonster.hp -= 0.5;
        log = addLog(log, 'Burned! -0.5HP', 'damage');
        dmgFlash = 2;
      }

      // Blob leaves fire trail on the square it LEFT
      if (g.monster.type === 'blob' && (newMonster.x !== oldX || newMonster.y !== oldY)) {
        if (!newFires.some(f => f.x === oldX && f.y === oldY)) {
          newFires.push({ x: oldX, y: oldY, life: 3 });
        }
      }

      newMonster.movesLeft--;
      if (newMonster.movesLeft <= 0) {
        return endTurn({ ...g, grid: newGrid, monster: newMonster, enemies: newEnemies, civilians: newCivs, fires: newFires, score, message: msg || g.message, damageFlash: dmgFlash, baseAlive, log, berserk });
      }
      return { ...g, grid: newGrid, monster: newMonster, enemies: newEnemies, civilians: newCivs, fires: newFires, score, message: msg || g.message, damageFlash: dmgFlash, baseAlive, log, berserk };
    });
  }, [game, endTurn]);

  const doThrow = useCallback(() => {
    if (!game || game.gameOver || !game.monster.carrying) return;
    setGame(g => {
      const newMonster = { ...g.monster, carrying: null };
      let log = [...g.log];
      let newEnemies = [...g.enemies];
      let newGrid = g.grid.map(r => r.map(c => c ? { ...c } : c));
      let score = g.score;

      // Throw in last move direction
      const [dx, dy] = g.monster.lastDir;
      let hitSomething = false;

      for (let i = 1; i <= 5; i++) {
        const tx = g.monster.x + dx * i;
        const ty = g.monster.y + dy * i;
        if (tx < 0 || tx >= CW || ty < 0 || ty >= CH) break;

        const hitEnemy = newEnemies.find(e => e.x === tx && e.y === ty);
        if (hitEnemy) {
          hitEnemy.hp -= 2;
          score += 30;
          log = addLog(log, `Threw ${g.monster.carrying.type} at ${hitEnemy.type}!`, 'score');
          hitSomething = true;
          break;
        }
        const cell = newGrid[ty][tx];
        if (cell && ['building', 'milbase', 'police', 'cityhall', 'lab'].includes(cell.type)) {
          cell.hp -= 2;
          score += 20;
          log = addLog(log, `Threw ${g.monster.carrying.type} at building!`, 'score');
          hitSomething = true;
          break;
        }
        // Stop at water/walls
        if (cell?.type === 'deepwater' || cell?.type === 'shallowwater') break;
      }

      if (!hitSomething) {
        log = addLog(log, `Threw ${g.monster.carrying.type} into the distance`, 'info');
      }

      return { ...g, grid: newGrid, monster: newMonster, enemies: newEnemies.filter(e => e.hp > 0), score, log };
    });
  }, [game]);

  const doRanged = useCallback(() => {
    if (!game || game.gameOver || game.monster.type !== 'lizard') return;
    setGame(g => {
      const range = 3;
      let newGrid = g.grid.map(r => r.map(c => c ? { ...c } : c));
      let newEnemies = [...g.enemies];
      let newCivs = [...g.civilians];
      let newFires = [...g.fires];
      let score = g.score;
      let log = [...g.log];
      let baseAlive = g.baseAlive;

      log = addLog(log, '🔥 FIRE BREATH!', 'info');

      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ddx, ddy]) => {
        for (let i = 1; i <= range; i++) {
          const tx = g.monster.x + ddx * i;
          const ty = g.monster.y + ddy * i;
          if (tx < 0 || tx >= CW || ty < 0 || ty >= CH) break;

          newCivs = newCivs.filter(c => !(c.x === tx && c.y === ty));
          newEnemies = newEnemies.filter(e => {
            if (e.x === tx && e.y === ty) { score += 40; return false; }
            return true;
          });

          const cell = newGrid[ty][tx];
          if (cell && ['building', 'milbase', 'police', 'cityhall', 'lab', 'park'].includes(cell.type)) {
            // Start fire!
            if (!newFires.some(f => f.x === tx && f.y === ty)) {
              newFires.push({ x: tx, y: ty, life: 3 });
            }
            cell.hp = (cell.hp || 1) - 2;
            if (cell.hp <= 0) {
              if (cell.type === 'milbase') { baseAlive = false; score += 500; }
              else if (cell.type === 'police') { score += 200; }
              else if (cell.type === 'cityhall') { score += 1000; }
              else if (cell.type === 'lab') { score += 300; }
              else if (cell.type === 'powerplant') {
                log = addLog(log, '💀 POWER PLANT EXPLODED!', 'damage');
                // Chain explosion!
                for (let ey = -2; ey <= 2; ey++) {
                  for (let ex = -2; ex <= 2; ex++) {
                    const exx = tx + ex, eyy = ty + ey;
                    if (exx >= 0 && exx < CW && eyy >= 0 && eyy < CH) {
                      newFires.push({ x: exx, y: eyy, life: 4 });
                    }
                  }
                }
              }
              newGrid[ty][tx] = { type: 'rubble' };
            }
            break;
          }
        }
      });

      return endTurn({ ...g, grid: newGrid, enemies: newEnemies, civilians: newCivs, fires: newFires, score, monster: { ...g.monster, movesLeft: 0 }, baseAlive, log });
    });
  }, [game, endTurn]);

  const doWait = useCallback(() => {
    if (!game || game.gameOver) return;
    setGame(g => endTurn({ ...g, monster: { ...g.monster, movesLeft: 0 } }));
  }, [game, endTurn]);

  // Berserk auto-move - simplified and self-contained
  useEffect(() => {
    if (!game || !game.berserk || game.gameOver || game.monster.movesLeft <= 0) return;

    const timer = setTimeout(() => {
      setGame(currentGame => {
        if (!currentGame || !currentGame.berserk || currentGame.gameOver || currentGame.monster.movesLeft <= 0) {
          return currentGame;
        }

        // Find a valid move direction
        const g = currentGame;

        // Find nearest food
        let nearest = null;
        let minDist = Infinity;

        g.civilians.forEach(c => {
          const d = Math.abs(c.x - g.monster.x) + Math.abs(c.y - g.monster.y);
          if (d < minDist) { minDist = d; nearest = { x: c.x, y: c.y }; }
        });
        g.enemies.forEach(e => {
          const d = Math.abs(e.x - g.monster.x) + Math.abs(e.y - g.monster.y);
          if (d < minDist) { minDist = d; nearest = { x: e.x, y: e.y }; }
        });

        // Get all valid directions
        const validDirs = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => {
          const tx = g.monster.x + dx, ty = g.monster.y + dy;
          if (tx < 0 || tx >= CW || ty < 0 || ty >= CH) return false;
          const tc = g.grid[ty]?.[tx];
          if (tc?.type === 'deepwater') return false;
          if (tc?.type === 'shallowwater' && g.monster.type !== 'lizard') return false;
          return true;
        });

        if (validDirs.length === 0) {
          // Completely stuck - end turn
          return endTurn({ ...g, monster: { ...g.monster, movesLeft: 0 } });
        }

        let chosenDir = null;

        // If we have food target, try to move toward it
        if (nearest) {
          const dx = Math.sign(nearest.x - g.monster.x);
          const dy = Math.sign(nearest.y - g.monster.y);

          // Try horizontal or vertical toward food
          chosenDir = validDirs.find(([vdx, vdy]) => (vdx === dx && vdx !== 0) || (vdy === dy && vdy !== 0));

          // Try any direction that gets us closer
          if (!chosenDir) {
            chosenDir = validDirs.find(([vdx, vdy]) => {
              const newDist = Math.abs(nearest.x - (g.monster.x + vdx)) + Math.abs(nearest.y - (g.monster.y + vdy));
              return newDist < minDist;
            });
          }
        }

        // Fall back to random valid direction
        if (!chosenDir) {
          chosenDir = validDirs[Math.floor(Math.random() * validDirs.length)];
        }

        // Now perform the move inline (simplified version of doMove)
        const [moveDx, moveDy] = chosenDir;
        const nx = g.monster.x + moveDx;
        const ny = g.monster.y + moveDy;

        const newMonster = { ...g.monster, x: nx, y: ny, movesLeft: g.monster.movesLeft - 1 };
        let newCivs = [...g.civilians];
        let newEnemies = [...g.enemies];
        let log = [...g.log];
        let berserk = g.berserk;
        let score = g.score;

        // Eat civilian at destination
        const civAtDest = newCivs.findIndex(c => c.x === nx && c.y === ny);
        if (civAtDest >= 0) {
          newCivs.splice(civAtDest, 1);
          newMonster.hunger = Math.max(0, newMonster.hunger - 4);
          newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 0.5);
          score += 10;
          log = addLog(log, 'CHOMP! Ate civilian!', 'heal');
          if (newMonster.hunger < newMonster.maxHunger * 0.5) {
            berserk = false;
            log = addLog(log, 'Regained control!', 'info');
          }
        }

        // Eat enemy at destination
        const enemyAtDest = newEnemies.findIndex(e => e.x === nx && e.y === ny);
        if (enemyAtDest >= 0) {
          const eaten = newEnemies[enemyAtDest];
          newEnemies.splice(enemyAtDest, 1);
          newMonster.hunger = Math.max(0, newMonster.hunger - 3);
          newMonster.hp = Math.min(newMonster.maxHp, newMonster.hp + 1);
          score += eaten.type === 'tank' ? 75 : 50;
          log = addLog(log, `CHOMP! Ate ${eaten.type}!`, 'heal');
          if (newMonster.hunger < newMonster.maxHunger * 0.5) {
            berserk = false;
            log = addLog(log, 'Regained control!', 'info');
          }
        }

        const newState = { ...g, monster: newMonster, civilians: newCivs, enemies: newEnemies, log, berserk, score };

        if (newMonster.movesLeft <= 0) {
          return endTurn(newState);
        }
        return newState;
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [game?.berserk, game?.gameOver, game?.monster?.movesLeft, game?.turn, endTurn]);

  useEffect(() => {
    if (screen !== 'game' || game?.berserk) return;
    const handle = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' ', '.', 't', 'e'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowUp' || e.key === 'w') doMove(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's') doMove(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a') doMove(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') doMove(1, 0);
      else if (e.key === ' ') doRanged();
      else if (e.key === '.') doWait();
      else if (e.key === 't') doThrow();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [screen, game?.berserk, doMove, doRanged, doWait, doThrow]);

  useEffect(() => {
    if (game?.damageFlash > 0) {
      const t = setTimeout(() => setGame(g => ({ ...g, damageFlash: g.damageFlash - 1 })), 100);
      return () => clearTimeout(t);
    }
  }, [game?.damageFlash]);

  if (screen === 'title') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-green-400 mb-2">CRUSH, RUMBLE & STOMP</h1>
        <p className="text-gray-400 mb-6">Choose your monster</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {Object.entries(MONSTERS).map(([key, m]) => (
            <button key={key} onClick={() => startGame(key)} className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600">
              <span className="text-3xl">{m.emoji}</span>
              <div className="text-left">
                <div className="text-green-400 font-bold">{m.name}</div>
                <div className="text-gray-400 text-sm">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const { grid, monster, enemies, civilians, fires, wind, message, gameOver, score, baseAlive, log, berserk } = game;
  const mDef = MONSTERS[monster.type];

  const vx = Math.max(0, Math.min(CW - VW, monster.x - Math.floor(VW / 2)));
  const vy = Math.max(0, Math.min(CH - VH, monster.y - Math.floor(VH / 2)));

  const getCell = (wx, wy) => {
    if (monster.x === wx && monster.y === wy) {
      return { display: mDef.emoji, bg: game.damageFlash > 0 ? '#ef4444' : berserk ? '#991b1b' : '#1a1a2e' };
    }
    const fire = fires.find(f => f.x === wx && f.y === wy);
    const enemy = enemies.find(e => e.x === wx && e.y === wy);
    if (enemy) return { display: { police: '👮', infantry: '💂', tank: '🚐', heli: '🚁' }[enemy.type], bg: fire ? '#f97316' : '#1a1a2e' };
    const civ = civilians.find(c => c.x === wx && c.y === wy);
    if (civ) return { display: '🏃', bg: fire ? '#f97316' : '#374151' };
    if (fire) return { display: '🔥', bg: '#f97316' };
    const cell = grid[wy]?.[wx];
    if (!cell) return { display: '', bg: '#2d3436' };
    if (cell.type === 'deepwater') return { display: '🌊', bg: '#1e3a5f' };
    if (cell.type === 'shallowwater') return { display: '〰️', bg: '#2d4a6f' };
    if (cell.type === 'road') return { display: '', bg: '#374151' };
    if (cell.type === 'rubble') return { display: '🧱', bg: '#292524' };
    if (cell.type === 'milbase') return { display: '⭐', bg: '#4a1d1d' };
    if (cell.type === 'police') return { display: '🚔', bg: '#1d3a5c' };
    if (cell.type === 'cityhall') return { display: '🏛️', bg: '#3d3a1d' };
    if (cell.type === 'lab') return { display: '🔬', bg: '#1d3d2a' };
    if (cell.type === 'powerplant') return { display: '⚡', bg: '#4a4a1d' };
    if (cell.type === 'bridge') return { display: '🌉', bg: '#4a4a4a' };
    if (cell.type === 'park') return { display: '🌳', bg: '#1d4a2a' };
    if (cell.type === 'building') {
      const ratio = cell.hp / cell.maxHp;
      return { display: { small: '🏠', medium: '🏢', large: '🏙️' }[cell.size], bg: ratio > 0.6 ? '#4b5563' : ratio > 0.3 ? '#78716c' : '#92400e' };
    }
    return { display: '', bg: '#2d3436' };
  };

  const hpPct = (monster.hp / monster.maxHp) * 100;
  const hungerPct = ((monster.maxHunger - monster.hunger) / monster.maxHunger) * 100;

  return (
    <div className="flex flex-col items-center p-2 bg-gray-900 min-h-screen">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-lg font-bold text-green-400">CRUSH, RUMBLE & STOMP</h1>
        <div className="flex gap-1">
          <button onClick={() => setZoom(z => Math.max(16, z - 4))} className="px-2 py-1 bg-gray-700 text-white rounded text-sm">−</button>
          <button onClick={() => setZoom(z => Math.min(48, z + 4))} className="px-2 py-1 bg-gray-700 text-white rounded text-sm">+</button>
        </div>
        <div className="text-gray-400 text-sm">Wind: {wind.name}</div>
      </div>

      <div className="flex gap-2">
        {/* Event Log */}
        <div className="w-40 h-96 bg-gray-800 rounded p-2 overflow-hidden flex flex-col">
          <div className="text-xs text-gray-400 mb-1 font-bold">EVENT LOG</div>
          <div className="flex-1 overflow-y-auto text-xs space-y-1">
            {log.map(l => (
              <div key={l.id} className={l.type === 'damage' ? 'text-red-400' : l.type === 'heal' ? 'text-green-400' : l.type === 'score' ? 'text-yellow-400' : 'text-gray-300'}>
                {l.msg}
              </div>
            ))}
          </div>
        </div>

        {/* Game Grid */}
        <div className={`border-2 overflow-hidden ${berserk ? 'border-red-500 animate-pulse' : 'border-green-500'}`}>
          <div style={{ lineHeight: 0 }}>
            {Array.from({ length: VH }, (_, row) => (
              <div key={row} className="flex">
                {Array.from({ length: VW }, (_, col) => {
                  const wx = vx + col, wy = vy + row;
                  const { display, bg } = getCell(wx, wy);
                  return (
                    <div key={col} className="flex items-center justify-center" style={{ width: zoom, height: zoom, backgroundColor: bg, fontSize: zoom * 0.6 }}>
                      {display}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Status Panel */}
        <div className="w-40 bg-gray-800 rounded p-2 flex flex-col gap-2">
          <div className="text-center">
            <span className="text-3xl">{mDef.emoji}</span>
            <div className="text-green-400 font-bold text-sm">{mDef.name}</div>
            {berserk && <div className="text-red-500 font-bold text-xs animate-pulse">BERSERK!</div>}
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs"><span className="text-red-400">HP</span><span className="text-red-400">{monster.hp.toFixed(1)}/{monster.maxHp}</span></div>
              <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${hpPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs"><span className={hungerPct < 25 ? "text-red-400" : "text-yellow-400"}>FOOD</span><span className="text-yellow-400">{Math.ceil(monster.maxHunger - monster.hunger)}/{monster.maxHunger}</span></div>
              <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
                <div className={`h-full transition-all ${hungerPct < 25 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${hungerPct}%` }} />
              </div>
            </div>
          </div>

          <div className="text-center text-green-400 font-bold">💯 {score}</div>
          <div className="text-center text-purple-400 text-sm">Moves: {monster.movesLeft}</div>
          <div className="text-center text-xs">{baseAlive ? <span className="text-red-400">⭐ Base: UP</span> : <span className="text-gray-500">⭐ Base: DOWN</span>}</div>

          {monster.carrying && (
            <div className="text-center text-xs text-blue-400">
              Carrying: {monster.carrying.emoji}
              <div className="text-gray-400">Throw dir: {monster.lastDir[0] === 1 ? '→' : monster.lastDir[0] === -1 ? '←' : monster.lastDir[1] === 1 ? '↓' : '↑'}</div>
            </div>
          )}

          <div className="flex flex-col gap-1 mt-2">
            {monster.type === 'lizard' && <button onClick={doRanged} className="px-2 py-1 bg-orange-600 text-white rounded text-xs">🔥 Fire (SPACE)</button>}
            {monster.type === 'ape' && monster.carrying && <button onClick={doThrow} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">🎯 Throw (T)</button>}
            <button onClick={doWait} className="px-2 py-1 bg-gray-600 text-white rounded text-xs">Wait (.)</button>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            <div>⚡ Power Plant</div>
            <div>🌳 Park</div>
            <div>🔥 Fire spreads!</div>
          </div>
        </div>
      </div>

      <div className={`mt-2 text-center text-sm max-w-md ${game.damageFlash > 0 ? 'text-red-400 font-bold' : berserk ? 'text-red-400' : 'text-green-300'}`}>{message}</div>

      {gameOver && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setGame(initGame(monster.type))} className="px-4 py-2 bg-green-600 text-white rounded">Play Again</button>
          <button onClick={() => setScreen('title')} className="px-4 py-2 bg-gray-600 text-white rounded">Change Monster</button>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">WASD/Arrows: move • {monster.type === 'lizard' ? 'SPACE: fire • ' : ''}{monster.type === 'ape' ? 'T: throw • ' : ''}Period: wait • ⚡=DEATH!</div>
    </div>
  );
}
