
const STANDARD = {
  A: ["Blanco/Verde","Verde","Blanco/Naranja","Azul","Blanco/Azul","Naranja","Blanco/Café","Café"],
  B: ["Blanco/Naranja","Naranja","Blanco/Verde","Azul","Blanco/Azul","Verde","Blanco/Café","Café"],
};

const WIRE_META = {
  "Blanco/Verde":  { key:"WG", swatch:["#f6f6f6","#39d07a"] },
  "Verde":         { key:"G",  swatch:["#39d07a"] },
  "Blanco/Naranja":{ key:"WO", swatch:["#f6f6f6","#ff9b3d"] },
  "Naranja":       { key:"O",  swatch:["#ff9b3d"] },
  "Azul":          { key:"BL", swatch:["#5bb2ff"] },
  "Blanco/Azul":   { key:"WBL",swatch:["#f6f6f6","#5bb2ff"] },
  "Blanco/Café":   { key:"WBR",swatch:["#f6f6f6","#9b6b43"] },
  "Café":          { key:"BR", swatch:["#9b6b43"] },
};

const PAIRS = [
  { name: "Par 1 (1-2)", pins: [1,2] },
  { name: "Par 2 (3-6)", pins: [3,6] },
  { name: "Par 3 (4-5)", pins: [4,5] },
  { name: "Par 4 (7-8)", pins: [7,8] },
];


const LEVELS = {
  1: { title:"Nivel 1 — Tutorial", mission:"Aprende el orden correcto. Hay pistas, puedes ver respuesta y se marca lo correcto/incorrecto.", showNames:true, showChip:true, allowHint:true, allowShow:true, maxAttempts: Infinity },
  2: { title:"Nivel 2 — Práctica", mission:"Sin respuesta. Puedes pedir pista (te revela 1 pin correcto).", showNames:true, showChip:true, allowHint:true, allowShow:false, maxAttempts: Infinity },
  3: { title:"Nivel 3 — Rápido", mission:"Sin nombres completos. Practica por color/código. Pista limitada.", showNames:false, showChip:true, allowHint:true, allowShow:false, maxAttempts: Infinity },
  4: { title:"Nivel 4 — Examen", mission:"Sin ayudas. Máximo 3 intentos. Si fallas: se reinicia el intento.", showNames:false, showChip:false, allowHint:false, allowShow:false, maxAttempts: 3 },
};

let state = {
  cableMode: "straight",
  baseStd: "B",          
  level: 1,
  score: 0,
  streak: 0,
  attempts: 0,
  timerStart: null,
  timerInterval: null,
  sounds: true,
  pairTest: true,
  hintUsedThisRound: 0, 
};

const el = {
  btnStraight: document.getElementById("btnStraight"),
  btnCrossover: document.getElementById("btnCrossover"),
  btnStdA: document.getElementById("btnStdA"),
  btnStdB: document.getElementById("btnStdB"),
  difficulty: document.getElementById("difficulty"),
  btnReset: document.getElementById("btnReset"),
  btnCheck: document.getElementById("btnCheck"),
  btnHint: document.getElementById("btnHint"),
  btnShow: document.getElementById("btnShow"),
  toggleSounds: document.getElementById("toggleSounds"),
  togglePairTest: document.getElementById("togglePairTest"),
  toast: document.getElementById("toast"),
  time: document.getElementById("time"),
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  attempts: document.getElementById("attempts"),
  maxAttempts: document.getElementById("maxAttempts"),
  missionTitle: document.getElementById("missionTitle"),
  missionText: document.getElementById("missionText"),
  labelA: document.getElementById("labelA"),
  labelB: document.getElementById("labelB"),
  panelB: document.getElementById("panelB"),
  paletteBCol: document.getElementById("paletteBCol"),
  wiresA: document.getElementById("wiresA"),
  wiresB: document.getElementById("wiresB"),
  slots: Array.from(document.querySelectorAll(".slot")),
  refA: document.getElementById("refA"),
  refB: document.getElementById("refB"),
};

function nowMs(){ return Date.now(); }
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtTime(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60);
  const r = s%60;
  return `${pad2(m)}:${pad2(r)}`;
}

function setToast(msg, type="warn"){
  el.toast.className = `toast ${type}`;
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
}
function clearToast(){
  el.toast.className = "toast hidden";
  el.toast.textContent = "";
}

function audioBeep(kind){
  if (!state.sounds) return;

  const ctx = audioBeep.ctx || (audioBeep.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);

  let freq = 440, dur = 0.12;
  if (kind === "ok"){ freq = 720; dur = 0.10; }
  if (kind === "bad"){ freq = 180; dur = 0.18; }
  if (kind === "hint"){ freq = 520; dur = 0.08; }
  if (kind === "win"){ freq = 880; dur = 0.14; }

  o.frequency.value = freq;
  o.type = "sine";
  g.gain.value = 0.06;

  o.start();
  o.stop(ctx.currentTime + dur);
}

function buildReference(){
  el.refA.innerHTML = "";
  el.refB.innerHTML = "";
  STANDARD.A.forEach((name, i) => {
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${name}`;
    el.refA.appendChild(li);
  });
  STANDARD.B.forEach((name, i) => {
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${name}`;
    el.refB.appendChild(li);
  });
}

function activeLevel(){
  return LEVELS[state.level];
}

function setActiveButtons(){
  el.btnStraight.classList.toggle("active", state.cableMode === "straight");
  el.btnCrossover.classList.toggle("active", state.cableMode === "crossover");
  el.btnStdA.classList.toggle("active", state.baseStd === "A");
  el.btnStdB.classList.toggle("active", state.baseStd === "B");
}

function standardsForEnds(){

  if (state.cableMode === "straight"){
    return { A: state.baseStd, B: state.baseStd };
  }

  return { A: state.baseStd, B: (state.baseStd === "A" ? "B" : "A") };
}

function updateUI(){
  const L = activeLevel();
  el.missionTitle.textContent = L.title;
  el.missionText.textContent = L.mission;

  el.score.textContent = String(state.score);
  el.streak.textContent = String(state.streak);
  el.attempts.textContent = String(state.attempts);
  el.maxAttempts.textContent = (L.maxAttempts === Infinity) ? "∞" : String(L.maxAttempts);

  el.btnHint.disabled = !L.allowHint;
  el.btnShow.disabled = !L.allowShow;

  el.toggleSounds.checked = state.sounds;
  el.togglePairTest.checked = state.pairTest;

  const ends = standardsForEnds();
  el.labelA.textContent = `Estándar: T568${ends.A}`;
  el.labelB.textContent = `Estándar: T568${ends.B}`;

  const showB = state.cableMode === "crossover";
  el.panelB.style.display = showB ? "block" : "none";
  el.paletteBCol.style.display = showB ? "block" : "none";

  setActiveButtons();
}

function resetTimer(){
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerStart = nowMs();
  el.time.textContent = "00:00";
  state.timerInterval = setInterval(() => {
    el.time.textContent = fmtTime(nowMs() - state.timerStart);
  }, 250);
}

function resetSlots(){
  el.slots.forEach(s => {
    s.innerHTML = "";
    s.classList.remove("drag-over","ok","bad");
  });
}

function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
}

function wireCard(name, end){
  const meta = WIRE_META[name];
  const L = activeLevel();

  const card = document.createElement("div");
  card.className = "wire";
  card.draggable = true;
  card.dataset.wire = name;
  card.dataset.end = end;
  card.id = `wire-${end}-${meta.key}-${Math.random().toString(16).slice(2)}`;

  const left = document.createElement("div");
  left.className = "left";

  const sw = document.createElement("div");
  sw.className = "swatch";
  if (meta.swatch.length === 1){
    sw.style.background = meta.swatch[0];
  } else {
    sw.style.background = `linear-gradient(90deg, ${meta.swatch[0]} 0 50%, ${meta.swatch[1]} 50% 100%)`;
  }

  const nm = document.createElement("div");
  nm.className = "name";
  nm.textContent = L.showNames ? name : "Cable";

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.textContent = L.showChip ? meta.key : " ";

  left.appendChild(sw);
  left.appendChild(nm);
  card.appendChild(left);
  card.appendChild(chip);

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  });

  return card;
}

function buildPalettes(){
  el.wiresA.innerHTML = "";
  el.wiresB.innerHTML = "";


  const namesA = [...STANDARD.A, ...STANDARD.B];

  const base8 = ["Blanco/Verde","Verde","Blanco/Naranja","Naranja","Azul","Blanco/Azul","Blanco/Café","Café"];

  const arrA = [...base8];
  shuffle(arrA);
  arrA.forEach(n => el.wiresA.appendChild(wireCard(n, "A")));

  if (state.cableMode === "crossover"){
    const arrB = [...base8];
    shuffle(arrB);
    arrB.forEach(n => el.wiresB.appendChild(wireCard(n, "B")));
  }
}

function attachDnD(){

  el.slots.forEach(slot => {
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("drag-over");
      e.dataTransfer.dropEffect = "move";
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");

      const id = e.dataTransfer.getData("text/plain");
      const wireEl = document.getElementById(id);
      if (!wireEl) return;

      const end = slot.dataset.end;
  
      if (wireEl.dataset.end !== end) return;

      const existing = slot.querySelector(".wire");
      if (existing){
   
        (existing.dataset.end === "A" ? el.wiresA : el.wiresB).appendChild(existing);
      }
      slot.appendChild(wireEl);
    });
  });


  [el.wiresA, el.wiresB].forEach((pal) => {
    pal.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    pal.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const wireEl = document.getElementById(id);
      if (!wireEl) return;
   
      if (pal === el.wiresA && wireEl.dataset.end !== "A") return;
      if (pal === el.wiresB && wireEl.dataset.end !== "B") return;
      pal.appendChild(wireEl);
    });
  });
}

function orderForEnd(end){
  const slots = el.slots.filter(s => s.dataset.end === end);
  return slots.map(s => {
    const w = s.querySelector(".wire");
    return w ? w.dataset.wire : null;
  });
}

function isComplete(order){
  return order.every(Boolean) && order.length === 8;
}

function expectedForEnd(end){
  const ends = standardsForEnds();
  const std = ends[end]; 
  return STANDARD[std];
}

function markSlots(end, expected, actual){
 
  const L = activeLevel();
  if (state.level !== 1) return;

  const slots = el.slots.filter(s => s.dataset.end === end);
  slots.forEach((s, idx) => {
    s.classList.remove("ok","bad");
    if (!actual[idx]) return;
    if (actual[idx] === expected[idx]) s.classList.add("ok");
    else s.classList.add("bad");
  });
}

function pairValidation(end, expected){

  const actual = orderForEnd(end);
  if (!isComplete(actual)) return { ok:false, details:["Faltan cables"] };

  const details = [];
  let ok = true;
  for (const p of PAIRS){
    const [a,b] = p.pins;
    const ea = expected[a-1], eb = expected[b-1];
    const aa = actual[a-1], ab = actual[b-1];
    const pairOk = (aa === ea && ab === eb);
    if (!pairOk){
      ok = false;
      details.push(`${p.name} incorrecto`);
    }
  }
  return { ok, details };
}

function computeResult(){
  const endsNeeded = (state.cableMode === "crossover") ? ["A","B"] : ["A"];
  const problems = [];

  for (const end of endsNeeded){
    const expected = expectedForEnd(end);
    const actual = orderForEnd(end);

    if (!isComplete(actual)){
      problems.push(`Extremo ${end}: faltan cables`);
      continue;
    }

    const orderOk = actual.every((v,i) => v === expected[i]);
    if (!orderOk){
      problems.push(`Extremo ${end}: orden incorrecto`);
    }

    if (state.pairTest){
      const pairRes = pairValidation(end, expected);
      if (!pairRes.ok){
  
        problems.push(`Extremo ${end}: ${pairRes.details.join(", ")}`);
      }
    }

    markSlots(end, expected, actual);
  }

  return { ok: problems.length === 0, problems };
}

function applyAttemptPenalty(){
  state.attempts += 1;
  const L = activeLevel();
  if (L.maxAttempts !== Infinity && state.attempts >= L.maxAttempts){
   
    state.streak = 0;
    audioBeep("bad");
    setToast(`Examen terminado (usaste ${L.maxAttempts} intentos). Reiniciando examen…`, "bad");
    setTimeout(() => startRound(true), 1000);
    return true;
  }
  return false;
}

function addScore(success){
  const elapsed = nowMs() - state.timerStart;
  const seconds = Math.max(1, Math.floor(elapsed/1000));

  if (success){
    state.streak += 1;
    
    const base = (state.cableMode === "crossover") ? 220 : 140;
    const speed = Math.max(0, Math.floor(120 - seconds)); 
    const streakBonus = Math.min(120, state.streak * 15);
    state.score += (base + speed + streakBonus);
  } else {
    state.streak = 0;
    
    state.score = Math.max(0, state.score - 40);
  }
}

function startRound(full=false){
  
  clearToast();
  resetSlots();
  buildPalettes();
  state.hintUsedThisRound = 0;
  if (full) state.attempts = 0;
  updateUI();
  resetTimer();
}

function hint(){
  const L = activeLevel();
  if (!L.allowHint){
    setToast("Este nivel no permite pistas.", "warn");
    return;
  }
  
  const maxHints = (state.level === 1) ? 99 : (state.level === 2 ? 2 : 1);
  if (state.hintUsedThisRound >= maxHints){
    setToast("Ya no hay más pistas en este nivel.", "warn");
    return;
  }

  const endsNeeded = (state.cableMode === "crossover") ? ["A","B"] : ["A"];
  for (const end of endsNeeded){
    const expected = expectedForEnd(end);
    const actual = orderForEnd(end);
    const slots = el.slots.filter(s => s.dataset.end === end);

    let idx = actual.findIndex(v => v === null);
    if (idx === -1){
      
      idx = actual.findIndex((v,i) => v !== expected[i]);
    }
    if (idx !== -1){
      const pin = idx + 1;
      audioBeep("hint");
      state.hintUsedThisRound += 1;
      setToast(`💡 Pista: Extremo ${end}, pin ${pin} debe ser "${expected[idx]}"`, "warn");
      
      slots[idx].classList.add("drag-over");
      setTimeout(() => slots[idx].classList.remove("drag-over"), 500);
      return;
    }
  }

  setToast("No encontré dónde aplicar la pista (todo parece completo).", "warn");
}

function showAnswer(){
  const L = activeLevel();
  if (!L.allowShow){
    setToast("Este nivel no permite mostrar la respuesta.", "warn");
    return;
  }

  
  resetSlots();

  
  buildPalettes();

  const endsNeeded = (state.cableMode === "crossover") ? ["A","B"] : ["A"];
  for (const end of endsNeeded){
    const expected = expectedForEnd(end);
    const slots = el.slots.filter(s => s.dataset.end === end);
    const palette = (end === "A" ? el.wiresA : el.wiresB);

    expected.forEach((name, idx) => {
      
      const wireEl = Array.from(palette.querySelectorAll(".wire")).find(w => w.dataset.wire === name);
      if (wireEl) slots[idx].appendChild(wireEl);
    });
  }

  setToast("Respuesta mostrada. Memoriza el orden y reinicia para practicar.", "warn");
}

function verify(){
  clearToast();

  
  const endsNeeded = (state.cableMode === "crossover") ? ["A","B"] : ["A"];
  for (const end of endsNeeded){
    const actual = orderForEnd(end);
    if (!isComplete(actual)){
      audioBeep("bad");
      setToast(`Te faltan cables en Extremo ${end}. Completa los 8 pines y vuelve a verificar.`, "warn");
      return;
    }
  }

  const res = computeResult();
  if (res.ok){
    audioBeep("win");
    addScore(true);
    setToast("✅ Correcto. ¡Cable armado bien! Se inicia una nueva ronda.", "good");
    updateUI();
    setTimeout(() => startRound(false), 850);
    return;
  }

  audioBeep("bad");
  addScore(false);
  updateUI();

  
  const msg = (state.level === 1)
    ? `❌ Incorrecto. ${res.problems.join(" • ")}. Reiniciando ronda…`
    : `❌ Incorrecto. Reiniciando ronda…`;

  setToast(msg, "bad");

 
  const examEnded = applyAttemptPenalty();
  if (examEnded) return;

  setTimeout(() => startRound(false), 900);
}

function onCableMode(mode){
  state.cableMode = mode;
  startRound(true);
}
function onStd(std){
  state.baseStd = std;
  startRound(true);
}
function onLevel(level){
  state.level = Number(level);
  
  startRound(true);
}

function init(){
  buildReference();
  attachDnD();

  state.cableMode = "straight";
  state.baseStd = "B";
  state.level = 1;

  el.btnStraight.addEventListener("click", () => onCableMode("straight"));
  el.btnCrossover.addEventListener("click", () => onCableMode("crossover"));
  el.btnStdA.addEventListener("click", () => onStd("A"));
  el.btnStdB.addEventListener("click", () => onStd("B"));
  el.difficulty.addEventListener("change", (e) => onLevel(e.target.value));
  el.btnReset.addEventListener("click", () => startRound(true));
  el.btnCheck.addEventListener("click", verify);
  el.btnHint.addEventListener("click", hint);
  el.btnShow.addEventListener("click", showAnswer);

  el.toggleSounds.addEventListener("change", (e) => {
    state.sounds = e.target.checked;
    if (state.sounds) audioBeep("ok");
  });
  el.togglePairTest.addEventListener("change", (e) => {
    state.pairTest = e.target.checked;
    setToast(state.pairTest ? "Validación por pares activada." : "Validación por pares desactivada.", "warn");
  });

  startRound(true);
  setToast("Arrastra cables y presiona Verificar. Cambia a Cruzado para practicar A↔B.", "warn");
}

init();

