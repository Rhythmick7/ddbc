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

// Replace your existing buildSchedule(...) with this function
function buildSchedule(nPlayers, nRounds, maxMatches) {
  const players = makePlayers(nPlayers);
  const idx = Object.fromEntries(players.map((p,i)=>[p,i]));
  const teammates = Array.from({length:nPlayers},()=>Array(nPlayers).fill(0));
  const opponents = Array.from({length:nPlayers},()=>Array(nPlayers).fill(0));

  // stats
  const specialCount = Object.fromEntries(players.map(p=>[p,0])); // how many times in 1v1/1v2
  const soloCount = Object.fromEntries(players.map(p=>[p,0]));
  const matchesPlayed = Object.fromEntries(players.map(p=>[p,0]));
  const sitOuts = Object.fromEntries(players.map(p=>[p,0]));
  const count2v2 = Object.fromEntries(players.map(p=>[p,0]));
  const count1v1 = Object.fromEntries(players.map(p=>[p,0]));
  const count1v2 = Object.fromEntries(players.map(p=>[p,0]));

  // capacity & sit-outs (distinct across rounds)
  const capacityPerRound = maxMatches * 4;
  const perRoundSit = Math.max(0, nPlayers - capacityPerRound);
  const totalSitSlots = perRoundSit * nRounds;
  if (totalSitSlots > nPlayers) return { error: `Impossible: need ${totalSitSlots} distinct sit-outs but only ${nPlayers} players.` };

  // build sit-out schedule (distinct players)
  const shuffledAll = shuffle(players);
  const sitOutList = shuffledAll.slice(0, totalSitSlots);
  const sitOutSchedule = [];
  for (let r=0;r<nRounds;r++){
    const start = r*perRoundSit;
    sitOutSchedule.push(sitOutList.slice(start, start+perRoundSit));
  }

  // compute specialSlotsPerRound
  const specialSlotsPerRound = [];
  let totalSpecialSlots = 0;
  for (let r=0;r<nRounds;r++){
    const sitOutThis = new Set(sitOutSchedule[r]||[]);
    const active = players.filter(p=>!sitOutThis.has(p));
    const mod = active.length % 4;
    let slots = 0;
    if (mod===1 && active.length>=5) slots = 5;
    else if (mod===2 && active.length>=2) slots = 2;
    else if (mod===3 && active.length>=3) slots = 3;
    specialSlotsPerRound.push(slots);
    totalSpecialSlots += slots;
  }

  // We'll assign special slots round-by-round picking players with lowest specialCount
  // but ensuring each round's special players are distinct within that round and are active
  const specialAssignedPerRound = Array.from({length:nRounds}, ()=>[]);

  // To avoid bias we will keep a rotating start order each round (shuffle once)
  const baseOrder = shuffle(players);

  for (let r=0;r<nRounds;r++){
    const need = specialSlotsPerRound[r];
    if (need === 0) continue;
    const sitOutThis = new Set(sitOutSchedule[r]||[]);
    const active = players.filter(p=>!sitOutThis.has(p));
    // build candidates sorted by (specialCount, matchesPlayed, random tie-break)
    const candidates = active.slice().map(p => ({p, sc:specialCount[p], mp:matchesPlayed[p], rand: Math.random()}))
      .sort((A,B)=> A.sc - B.sc || A.mp - B.mp || A.rand - B.rand)
      .map(o=>o.p);
    // pick first 'need' distinct players
    const chosen=[];
    for (let i=0;i<candidates.length && chosen.length<need;i++){
      const c = candidates[i];
      if (!chosen.includes(c)) chosen.push(c);
    }
    // If not enough candidates (edge case), fill from active players not yet chosen
    if (chosen.length < need){
      for (const p of active){
        if (chosen.length>=need) break;
        if (!chosen.includes(p)) chosen.push(p);
      }
    }
    specialAssignedPerRound[r] = chosen.slice(0, need);
    // increment specialCount tentatively; actual specials will be consumed when building matches
    for (const p of specialAssignedPerRound[r]) specialCount[p]++; // this ensures later rounds pick others first
  }

  // After preassigning specials, build rounds using those sets
  const rounds = [];

  for (let r=0;r<nRounds;r++){
    const sitOutThis = new Set(sitOutSchedule[r]||[]);
    let active = players.filter(p=>!sitOutThis.has(p));
    // pool = players available to allocate to matches this round (we will remove as used)
    let pool = shuffle(active);
    const matches = [];

    // get the special set for this round (preassigned) - ensure they are active and unique
    let specialSet = (specialAssignedPerRound[r] || []).filter(p => active.includes(p));
    specialSet = Array.from(new Set(specialSet));

    // remove specialSet from pool
    pool = pool.filter(p => !specialSet.includes(p));

    // Build special matches exactly from specialSet according to the needed pattern
    const slots = specialSlotsPerRound[r];
    if (slots === 5) {
      // 1x1v2 (3 players) + 1x1v1 (2 players)
      // We must pick solo for 1v2 from specialSet (lowest soloCount), then remaining pair and remaining two form 1v1
      if (specialSet.length < 5) {
        // should not occur if preassignment worked, but fallback: take from pool if needed
        while (specialSet.length < 5 && pool.length>0) specialSet.push(pool.shift());
      }
      // choose solo by lowest soloCount then lowest specialCount
      specialSet.sort((a,b)=> soloCount[a] - soloCount[b] || specialCount[a] - specialCount[b] || Math.random()-0.5);
      const solo = specialSet.shift();
      const pair = [specialSet.shift(), specialSet.shift()];
      const onev1pair = [specialSet.shift(), specialSet.shift()];
      matches.push({type:'1v2', team1:[solo], team2:pair});
      matches.push({type:'1v1', team1:[onev1pair[0]], team2:[onev1pair[1]]});
      // update counts
      soloCount[solo]++; specialCount[solo]++; specialCount[pair[0]]++; specialCount[pair[1]]++;
      specialCount[onev1pair[0]]++; specialCount[onev1pair[1]]++;
      count1v2[solo]++; count1v2[pair[0]]++; count1v2[pair[1]]++;
      count1v1[onev1pair[0]]++; count1v1[onev1pair[1]]++;
    } else if (slots === 3) {
      // single 1v2 from specialSet
      if (specialSet.length < 3) while (specialSet.length < 3 && pool.length>0) specialSet.push(pool.shift());
      specialSet.sort((a,b)=> soloCount[a] - soloCount[b] || specialCount[a] - specialCount[b] || Math.random()-0.5);
      const solo = specialSet.shift();
      const pair = [specialSet.shift(), specialSet.shift()];
      matches.push({type:'1v2', team1:[solo], team2:pair});
      soloCount[solo]++; specialCount[solo]++; specialCount[pair[0]]++; specialCount[pair[1]]++;
      count1v2[solo]++; count1v2[pair[0]]++; count1v2[pair[1]]++;
    } else if (slots === 2) {
      // single 1v1 from specialSet
      if (specialSet.length < 2) while (specialSet.length < 2 && pool.length>0) specialSet.push(pool.shift());
      const [a,b] = specialSet.slice(0,2);
      matches.push({type:'1v1', team1:[a], team2:[b]});
      specialCount[a]++; specialCount[b]++; soloCount[a]++; soloCount[b]++;
      count1v1[a]++; count1v1[b]++;
    }

    // Now fill remaining matches up to maxMatches with 2v2 using pool
    // We choose groups of 4 that minimize repeats by brute-forcing small candidate window
    while (pool.length >= 4 && matches.length < maxMatches) {
      const K = Math.min(10, pool.length);
      const cand = pool.slice(0, K);
      let bestGroup = null, bestScore = Infinity, bestPickIdx = null;
      // enumerate combos of 4 from cand
      for (let a=0;a<cand.length;a++){
        for (let b=a+1;b<cand.length;b++){
          for (let c=b+1;c<cand.length;c++){
            for (let d=c+1;d<cand.length;d++){
              const group = [cand[a], cand[b], cand[c], cand[d]];
              // consider the three splits
              const splits = [
                [[group[0],group[1]],[group[2],group[3]]],
                [[group[0],group[2]],[group[1],group[3]]],
                [[group[0],group[3]],[group[1],group[2]]]
              ];
              for (const [t1,t2] of splits){
                // score = teammate repeats + opponent repeats
                let s = 0;
                if (t1.length===2) s += teammates[idx[t1[0]]][idx[t1[1]]];
                if (t2.length===2) s += teammates[idx[t2[0]]][idx[t2[1]]];
                s += opponentPenalty(t1,t2,opponents,idx);
                if (s < bestScore) { bestScore = s; bestGroup = {team1:t1.slice(), team2:t2.slice()}; bestPickIdx=[a,b,c,d]; }
              }
            }
          }
        }
      }
      // remove chosen group from pool
      if (bestPickIdx){
        const picked = [cand[bestPickIdx[0]], cand[bestPickIdx[1]], cand[bestPickIdx[2]], cand[bestPickIdx[3]]];
        pool = pool.filter(p => !picked.includes(p));
        matches.push({ type:'2v2', team1: bestGroup.team1, team2: bestGroup.team2 });
        bestGroup.team1.concat(bestGroup.team2).forEach(p => count2v2[p]++);
      } else {
        // fallback
        const g = pool.splice(0,4);
        matches.push({ type:'2v2', team1:[g[0],g[1]], team2:[g[2],g[3]] });
        [g[0],g[1],g[2],g[3]].forEach(p => count2v2[p]++);
      }
    }

    // If any pool players remain (shouldn't occur if sit-outs computed correctly), treat them as sit-outs
    if (pool.length > 0) {
      for (const p of pool) sitOuts[p]++;
      pool = [];
    }

    // Update global matrices & matchesPlayed for this round's matches
    for (const m of matches){
      if (m.type === '2v2'){
        const [a,b]=m.team1, [c,d]=m.team2;
        teammates[idx[a]][idx[b]]++; teammates[idx[b]][idx[a]]++;
        teammates[idx[c]][idx[d]]++; teammates[idx[d]][idx[c]]++;
        [a,b].forEach(x=>[c,d].forEach(y=>{
          opponents[idx[x]][idx[y]]++; opponents[idx[y]][idx[x]]++;
        }));
        matchesPlayed[a]++; matchesPlayed[b]++; matchesPlayed[c]++; matchesPlayed[d]++;
      } else if (m.type === '1v2'){
        const solo = m.team1[0], [x,y]=m.team2;
        teammates[idx[x]][idx[y]]++; teammates[idx[y]][idx[x]]++;
        opponents[idx[solo]][idx[x]]++; opponents[idx[x]][idx[solo]]++;
        opponents[idx[solo]][idx[y]]++; opponents[idx[y]][idx[solo]]++;
        matchesPlayed[solo]++; matchesPlayed[x]++; matchesPlayed[y]++;
      } else if (m.type === '1v1'){
        const a = m.team1[0], b = m.team2[0];
        opponents[idx[a]][idx[b]]++; opponents[idx[b]][idx[a]]++;
        matchesPlayed[a]++; matchesPlayed[b]++;
      }
    }

    rounds.push({ matches, sitOuts: Array.from(sitOutThis) });
  }

  return {
    rounds, teammates, opponents, players,
    specialCount, soloCount, matchesPlayed, sitOuts,
    count2v2, count1v1, count1v2
  };
}

// helper
function opponentPenalty(teamA, teamB, opponents, idx){
  let s=0;
  for(const a of teamA) for(const b of teamB) s += opponents[idx[a]][idx[b]];
  return s;
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
