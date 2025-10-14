function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makePlayers(n) {
  const names = [];
  for (let i = 0; i < n; i++) names.push(String.fromCharCode(65 + i));
  return names;
}

function buildSchedule(nPlayers, nRounds, maxMatches) {
  const players = makePlayers(nPlayers);
  const idx = Object.fromEntries(players.map((p, i) => [p, i]));
  const teammates = Array.from({ length: nPlayers }, () => Array(nPlayers).fill(0));
  const opponents = Array.from({ length: nPlayers }, () => Array(nPlayers).fill(0));

  const specialCount = Object.fromEntries(players.map(p => [p, 0]));
  const soloCount = Object.fromEntries(players.map(p => [p, 0]));
  const matchesPlayed = Object.fromEntries(players.map(p => [p, 0]));
  const sitOuts = Object.fromEntries(players.map(p => [p, 0]));
  const count2v2 = Object.fromEntries(players.map(p => [p, 0]));
  const count1v1 = Object.fromEntries(players.map(p => [p, 0]));
  const count1v2 = Object.fromEntries(players.map(p => [p, 0]));

  const capacityPerRound = maxMatches * 4;
  const perRoundSit = Math.max(0, nPlayers - capacityPerRound);
  const totalSitSlots = perRoundSit * nRounds;
  const allPlayersShuffled = shuffle(players);
  const sitOutList = allPlayersShuffled.slice(0, totalSitSlots);
  const sitOutSchedule = [];
  for (let r = 0; r < nRounds; r++) {
    const start = r * perRoundSit;
    sitOutSchedule.push(sitOutList.slice(start, start + perRoundSit));
  }

  const rounds = [];
  for (let r = 0; r < nRounds; r++) {
    const sitOutThis = new Set(sitOutSchedule[r] || []);
    const active = players.filter(p => !sitOutThis.has(p));
    let pool = shuffle(active);
    const matches = [];

    const mod = pool.length % 4;
    const removeFromPool = (list) => { for (const p of list) pool = pool.filter(x => x !== p); };
    const pickPlayers = (num, exclude = []) => {
      const eligible = pool.filter(p => !exclude.includes(p))
        .sort((a, b) => specialCount[a] - specialCount[b] || matchesPlayed[a] - matchesPlayed[b]);
      return eligible.slice(0, num);
    };

    if (mod === 1 && pool.length >= 5) {
      const oneV2Players = pickPlayers(3);
      const [solo, ...pair] = oneV2Players.sort((a, b) => soloCount[a] - soloCount[b]);
      matches.push({ type: "1v2", team1: [solo], team2: pair });
      removeFromPool(oneV2Players);
      [solo, ...pair].forEach(p => specialCount[p]++);
      soloCount[solo]++; count1v2[solo]++; pair.forEach(p => count1v2[p]++);

      const oneV1Players = pickPlayers(2);
      matches.push({ type: "1v1", team1: [oneV1Players[0]], team2: [oneV1Players[1]] });
      removeFromPool(oneV1Players);
      oneV1Players.forEach(p => { specialCount[p]++; soloCount[p]++; count1v1[p]++; });
    }
    else if (mod === 2 && pool.length >= 2) {
      const oneV1Players = pickPlayers(2);
      matches.push({ type: "1v1", team1: [oneV1Players[0]], team2: [oneV1Players[1]] });
      removeFromPool(oneV1Players);
      oneV1Players.forEach(p => { specialCount[p]++; soloCount[p]++; count1v1[p]++; });
    }
    else if (mod === 3 && pool.length >= 3) {
      const oneV2Players = pickPlayers(3);
      const [solo, ...pair] = oneV2Players.sort((a, b) => soloCount[a] - soloCount[b]);
      matches.push({ type: "1v2", team1: [solo], team2: pair });
      removeFromPool(oneV2Players);
      [solo, ...pair].forEach(p => specialCount[p]++);
      soloCount[solo]++; count1v2[solo]++; pair.forEach(p => count1v2[p]++);
    }

    while (pool.length >= 4 && matches.length < maxMatches) {
      const group = pickPlayers(4);
      const [a, b, c, d] = group;
      matches.push({ type: "2v2", team1: [a, b], team2: [c, d] });
      removeFromPool(group);
      [a, b, c, d].forEach(p => count2v2[p]++);
    }

    if (pool.length > 0) {
      pool.forEach(p => { sitOutThis.add(p); sitOuts[p]++; });
      pool = [];
    }

    for (const m of matches) {
      if (m.type === "2v2") {
        const [a, b] = m.team1, [c, d] = m.team2;
        teammates[idx[a]][idx[b]]++; teammates[idx[b]][idx[a]]++;
        teammates[idx[c]][idx[d]]++; teammates[idx[d]][idx[c]]++;
        [a, b].forEach(x => {
        [c, d].forEach(y => {
            opponents[idx[x]][idx[y]]++;
            opponents[idx[y]][idx[x]]++;
        });
});
        [a, b, c, d].forEach(p => matchesPlayed[p]++);
      } else if (m.type === "1v2") {
        const solo = m.team1[0], [x, y] = m.team2;
        teammates[idx[x]][idx[y]]++; teammates[idx[y]][idx[x]]++;
        [x, y].forEach(t => { opponents[idx[solo]][idx[t]]++; opponents[idx[t]][idx[solo]]++; });
        [solo, x, y].forEach(p => matchesPlayed[p]++);
      } else if (m.type === "1v1") {
        const a = m.team1[0], b = m.team2[0];
        opponents[idx[a]][idx[b]]++; opponents[idx[b]][idx[a]]++;
        [a, b].forEach(p => matchesPlayed[p]++);
      }
    }

    rounds.push({ matches, sitOuts: Array.from(sitOutThis) });
  }

  return { rounds, teammates, opponents, players, specialCount, soloCount, matchesPlayed, sitOuts, count2v2, count1v1, count1v2 };
}

function generate() {
  const nPlayers = parseInt(document.getElementById("players").value);
  const nRounds = parseInt(document.getElementById("rounds").value);
  const maxMatches = parseInt(document.getElementById("maxMatches").value);
  const result = buildSchedule(nPlayers, nRounds, maxMatches);
  const output = document.getElementById("output");
  const summary = document.getElementById("summary");
  const exportButtons = document.getElementById("exportButtons");

  let text = "";
  result.rounds.forEach((round, i) => {
    text += `Round ${i + 1}\n`;
    round.matches.forEach((m, j) => {
      text += `  Match ${j + 1}: ${m.team1.join(" & ")} vs ${m.team2.join(" & ")}\n`;
    });
    if (round.sitOuts.length) text += `  Sit outs: ${round.sitOuts.join(", ")}\n`;
    text += "\n";
  });
  output.textContent = text;

  let html = `<table><tr><th>Player</th><th>Matches</th><th>2v2</th><th>1v1</th><th>1v2</th><th>Sit Outs</th><th>Solo</th></tr>`;
  result.players.forEach(p => {
    html += `<tr><td>${p}</td><td>${result.matchesPlayed[p]}</td><td>${result.count2v2[p]}</td><td>${result.count1v1[p]}</td><td>${result.count1v2[p]}</td><td>${result.sitOuts[p]}</td><td>${result.soloCount[p]}</td></tr>`;
  });
  html += "</table>";
  summary.innerHTML = html;

  exportButtons.style.display = "block";
  window.latestSchedule = result;
}

function exportCSV() {
  const res = window.latestSchedule;
  if (!res) return;

  let csv = "Round Robin Schedule\n\n";
  res.rounds.forEach((r, i) => {
    csv += `Round ${i + 1}\n`;
    r.matches.forEach((m, j) => {
      csv += `Match ${j + 1},${m.team1.join(" & ")} vs ${m.team2.join(" & ")}\n`;
    });
    if (r.sitOuts.length) csv += `Sit outs,${r.sitOuts.join(",")}\n`;
    csv += "\n";
  });

  csv += "\nPlayer Stats\nPlayer,Matches,2v2,1v1,1v2,SitOuts,Solo\n";
  res.players.forEach(p => {
    csv += `${p},${res.matchesPlayed[p]},${res.count2v2[p]},${res.count1v1[p]},${res.count1v2[p]},${res.sitOuts[p]},${res.soloCount[p]}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "schedule.csv";
  a.click();
}

async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const res = window.latestSchedule;
  if (!res) return;

  let y = 10;
  doc.setFontSize(16);
  doc.text("Round Robin Schedule", 10, y);
  doc.setFontSize(12);
  y += 10;

  res.rounds.forEach((r, i) => {
    doc.text(`Round ${i + 1}`, 10, y);
    y += 6;
    r.matches.forEach((m, j) => {
      doc.text(`Match ${j + 1}: ${m.team1.join(" & ")} vs ${m.team2.join(" & ")}`, 14, y);
      y += 6;
    });
    if (r.sitOuts.length) {
      doc.text(`Sit outs: ${r.sitOuts.join(", ")}`, 14, y);
      y += 8;
    } else y += 4;
    if (y > 270) { doc.addPage(); y = 10; }
  });

  doc.save("schedule.pdf");
}
