// scheduler.js  —  final balanced round-robin scheduler
// Pure JavaScript, no frameworks
// Compatible with the existing HTML generator UI

function generateSchedule() {
  const numPlayers = parseInt(document.getElementById("numPlayers").value);
  const numRounds = parseInt(document.getElementById("numRounds").value);
  const maxMatches = parseInt(document.getElementById("maxMatches").value);

  if (isNaN(numPlayers) || numPlayers < 4 || numPlayers > 32) {
    alert("Please enter between 4 and 32 players.");
    return;
  }

  const players = Array.from({ length: numPlayers }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  const schedule = buildSchedule(players, numRounds, maxMatches);
  displaySchedule(schedule);
  enableExports(schedule);
}

// ---------------------------------------------------------------------------
// Main scheduler logic
// ---------------------------------------------------------------------------
function buildSchedule(players, numRounds, maxMatches) {
  const rounds = [];
  const n = players.length;

  const teammates = Object.fromEntries(players.map(p => [p, Object.fromEntries(players.map(q => [q, 0]))]));
  const opponents = Object.fromEntries(players.map(p => [p, Object.fromEntries(players.map(q => [q, 0]))]));

  // tracking counts
  const specialCount = Object.fromEntries(players.map(p => [p, 0]));
  const soloCount = Object.fromEntries(players.map(p => [p, 0]));
  const matchesPlayed = Object.fromEntries(players.map(p => [p, 0]));
  const sitOuts = Object.fromEntries(players.map(p => [p, 0]));

  // helper to shuffle array
  function shuffle(arr) {
    return arr.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
  }

  // determine base pattern (1v2 + 1v1 + 2v2...)
  const playersPerRound = Math.min(n, maxMatches * 4);
  let basePattern = [];
  if (playersPerRound % 4 === 1) basePattern = ["1v2", "1v1", "2v2", "2v2"];
  else if (playersPerRound % 4 === 2) basePattern = ["1v1", "2v2", "2v2"];
  else if (playersPerRound % 4 === 3) basePattern = ["1v2", "2v2", "2v2"];
  else basePattern = Array(maxMatches).fill("2v2");

  for (let r = 0; r < numRounds; r++) {
    const roundMatches = [];
    let available = [...players];

    // If too many players, assign sitouts evenly (no player > 1 sitout if possible)
    const requiredSlots = basePattern.reduce((sum, t) => sum + (t === "2v2" ? 4 : t === "1v1" ? 2 : 3), 0);
    const overflow = n - requiredSlots;
    const numSitouts = overflow > 0 ? overflow : 0;

    const sitOutPlayers = [];
    if (numSitouts > 0) {
      const sitCandidates = [...players].sort(
        (a, b) => sitOuts[a] - sitOuts[b] || Math.random() - 0.5
      );
      for (let i = 0; i < numSitouts; i++) {
        const p = sitCandidates[i];
        sitOuts[p]++;
        sitOutPlayers.push(p);
        available = available.filter(x => x !== p);
      }
    }

    // assign matches following basePattern
    const localPattern = [...basePattern];
    while (available.length > 0 && localPattern.length > 0) {
      const pattern = localPattern.shift();
      if (pattern === "2v2" && available.length >= 4) {
        // choose 4 players minimizing repeats
        const group = pickLeastRepeated(available, teammates, opponents, 4);
        const [a, b, c, d] = group;
        updateStats(teammates, opponents, [a, b], [c, d]);
        [a, b, c, d].forEach(p => matchesPlayed[p]++);
        roundMatches.push({ type: "2v2", team1: [a, b], team2: [c, d] });
        available = available.filter(x => !group.includes(x));
      } else if (pattern === "1v1" && available.length >= 2) {
        const [a, b] = pickSpecialPair(available, specialCount, soloCount, 2, true);
        roundMatches.push({ type: "1v1", team1: [a], team2: [b] });
        [a, b].forEach(p => {
          specialCount[p]++;
          soloCount[p]++;
          matchesPlayed[p]++;
        });
        opponents[a][b]++; opponents[b][a]++;
        available = available.filter(x => x !== a && x !== b);
      } else if (pattern === "1v2" && available.length >= 3) {
        const [a, b, c] = pickSpecialPair(available, specialCount, soloCount, 3, false);
        roundMatches.push({ type: "1v2", team1: [a], team2: [b, c] });
        specialCount[a]++; specialCount[b]++; specialCount[c]++;
        soloCount[a]++;
        matchesPlayed[a]++; matchesPlayed[b]++; matchesPlayed[c]++;
        opponents[a][b]++; opponents[a][c]++; opponents[b][a]++; opponents[c][a]++;
        teammates[b][c]++; teammates[c][b]++;
        available = available.filter(x => ![a, b, c].includes(x));
      } else break;
    }

    rounds.push({ round: r + 1, matches: roundMatches, sitOuts: sitOutPlayers });
  }

  // recompute authoritative stats from rounds
  const recomputed = recomputeStats(players, rounds);
  return { rounds, players, teammates, opponents, ...recomputed };
}

// ---------------------------------------------------------------------------
// helper functions
// ---------------------------------------------------------------------------
function recomputeStats(players, rounds) {
  const out = {
    specialCount: {}, soloCount: {}, matchesPlayed: {},
    count2v2: {}, count1v1: {}, count1v2: {}, sitOuts: {}
  };
  players.forEach(p => {
    out.specialCount[p] = 0;
    out.soloCount[p] = 0;
    out.matchesPlayed[p] = 0;
    out.count2v2[p] = 0;
    out.count1v1[p] = 0;
    out.count1v2[p] = 0;
    out.sitOuts[p] = 0;
  });

  for (const R of rounds) {
    for (const p of R.sitOuts || []) out.sitOuts[p]++;
    for (const m of R.matches) {
      if (m.type === "2v2") {
        const [a,b]=m.team1,[c,d]=m.team2;
        [a,b,c,d].forEach(p=>{out.count2v2[p]++;out.matchesPlayed[p]++;});
      } else if (m.type === "1v1") {
        const [a]=m.team1,[b]=m.team2;
        [a,b].forEach(p=>{
          out.count1v1[p]++; out.specialCount[p]++; out.soloCount[p]++; out.matchesPlayed[p]++;
        });
      } else if (m.type === "1v2") {
        const [a]=m.team1,[b,c]=m.team2;
        [a,b,c].forEach(p=>{
          out.count1v2[p]++; out.specialCount[p]++; out.matchesPlayed[p]++;
        });
        out.soloCount[a]++;
      }
    }
  }
  return out;
}

// pick least repeated players for 2v2
function pickLeastRepeated(available, teammates, opponents, count) {
  const combos = [];
  const arr = shuffle(available);
  for (let i = 0; i < arr.length - 3; i++)
    for (let j = i + 1; j < arr.length - 2; j++)
      for (let k = j + 1; k < arr.length - 1; k++)
        for (let l = k + 1; l < arr.length; l++) {
          const g = [arr[i], arr[j], arr[k], arr[l]];
          let score = 0;
          const pairs = [[g[0],g[1]],[g[2],g[3]]];
          score += teammates[g[0]][g[1]] + teammates[g[2]][g[3]];
          score += opponents[g[0]][g[2]] + opponents[g[0]][g[3]] +
                   opponents[g[1]][g[2]] + opponents[g[1]][g[3]];
          combos.push({ g, score });
        }
  combos.sort((a,b)=>a.score-b.score || Math.random()-0.5);
  return combos.length ? combos[0].g : arr.slice(0,count);
}

// pick special match participants
function pickSpecialPair(available, specialCount, soloCount, size, oneVone) {
  const sorted = [...available].sort((a,b)=>{
    const sa = specialCount[a], sb = specialCount[b];
    const so = soloCount[a], so2 = soloCount[b];
    return sa - sb || so - so2 || Math.random() - 0.5;
  });
  return sorted.slice(0, size);
}

function updateStats(teammates, opponents, t1, t2) {
  for (const a of t1)
    for (const b of t1)
      if (a!==b) teammates[a][b]++;
  for (const a of t2)
    for (const b of t2)
      if (a!==b) teammates[a][b]++;
  for (const a of t1)
    for (const b of t2) {
      opponents[a][b]++; opponents[b][a]++;
    }
}

function shuffle(arr) {
  return arr.map(x => [Math.random(), x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}

// ---------------------------------------------------------------------------
// Display and export helpers
// ---------------------------------------------------------------------------
function displaySchedule(schedule) {
  const container = document.getElementById("schedule");
  container.innerHTML = "";
  schedule.rounds.forEach(R => {
    const div = document.createElement("div");
    div.className = "round";
    div.innerHTML = `<h3>Round ${R.round}</h3>`;
    R.matches.forEach(m => {
      if (m.type === "2v2")
        div.innerHTML += `<div>${m.team1.join(", ")} vs ${m.team2.join(", ")}</div>`;
      else if (m.type === "1v1")
        div.innerHTML += `<div>${m.team1[0]} vs ${m.team2[0]} (1v1)</div>`;
      else
        div.innerHTML += `<div>${m.team1[0]} vs (${m.team2.join(", ")}) (1v2)</div>`;
    });
    if (R.sitOuts.length)
      div.innerHTML += `<div><em>Sitting out: ${R.sitOuts.join(", ")}</em></div>`;
    container.appendChild(div);
  });
}

function enableExports(schedule) {
  document.getElementById("exportButtons").style.display = "block";
  window.currentSchedule = schedule;
}

// Export to CSV and PDF implemented elsewhere in UI
