"use strict";
console.log("SCRIPT START");

/* =========================================================
   Locale helpers
========================================================= */
const SEP_UI = ','; // UI toont komma

function toInternal(val) {
  return String(val).replace(',', '.');
}

function toUI(val) {
  return String(val).replace('.', SEP_UI);
}

function parseLearnerNumber(s) {
  const n = parseFloat(toInternal(s));
  return Number.isFinite(n) ? n : null;
}
function divMetVasteDecimalen(dividend, divisor, dec = 2){
  const pow = 10 ** dec;
  // Truncatie (geen afronding): vermenigvuldigen -> floor -> terugschalen
  const qTrunc = Math.floor((dividend / divisor) * pow) / pow;
  const r = Number((dividend - qTrunc * divisor).toFixed(dec));
  return { q: qTrunc, r };
}

/* =========================================================
   CONFIG
========================================================= */
const CONFIG = {
  maxDecimalen: 3,
  maxDivisor: 20,
  maxQuotient: 50
};

/* =========================================================
   FEEDBACK-TEKSTEN (niveau 1-3 inhoudelijk, 4-5 generiek)
========================================================= */
const FEEDBACK = {
  // -- bestond al --
  VERDEEL_FOUT: {
    1: "Het quotiënt in het antwoordveld klopt niet. Controleer je berekening of je overname uit het werkveld.",
    2: "Controleer of je quotiënt klopt (let op overnemen).",
    3: "Quotiënt klopt niet."
  },
  REST_FOUT: {
    1: "De rest in het antwoordveld klopt niet. Reken rest = deeltal − (quotiënt × deler) na, of controleer het overnemen.",
    2: "Kijk je rest nog eens na (of het overnemen).",
    3: "Rest klopt niet."
  },
  KOMMA_NIET: {
    1: "Er hoort een komma in het quotiënt. Bepaal en noteer de plaats van de komma.",
    2: "Controleer of er een komma nodig is.",
    3: "Komma ontbreekt."
  },
  KOMMA_FOUT: {
    1: "De komma staat op een verkeerde plaats in het quotiënt.",
    2: "Controleer de kommaplaats.",
    3: "Kommaplaats fout."
  },
  INVOER_QUOTIENT_LEEG: {
    1: "Het quotiënt is niet ingevuld. Vul eerst je antwoord in.",
    2: "Quotiënt ontbreekt.",
    3: "Geen quotiënt."
  },
  INVOER_REST_LEEG: {
    1: "De rest is niet ingevuld. Noteer 0 als er geen rest is.",
    2: "Rest ontbreekt.",
    3: "Geen rest."
  }
};

function feedbackText(code, level) {
  const l = Math.min(Math.max(Number(level)||1,1),3); // 1..3
  return FEEDBACK[code] ? FEEDBACK[code][l] : "";
}

/* =========================================================
   STATE
========================================================= */
const state = {
  dividend: 0,
  divisor: 0,
  stappen: [],
  level: "1",
  instellingen: { decimalen: false, controle: false },

  showCommaPlaceholder: false,
  decimalReminderShown: false,
  selectedIndex: null,
  decimalQuotPos: null,
  userDecimalPos: null,
  decimalDividendPos: null,
  originalDividend: null,
  originalDivisor: null
};

/* =========================================================
   WISKUNDE HULPFUNCTIES
========================================================= */
function rondAf(getal, decimals) {
  return Number(getal.toFixed(decimals));
}

function randomDecimal(min, max, dec) {
  const factor = 10 ** dec;
  return Math.round((Math.random()*(max-min)+min)*factor)/factor;
}

function decimalPlaces(val){
  const s = toInternal(val);
  const i = s.indexOf('.');
  return i === -1 ? 0 : (s.length - i - 1);
}

function scaleNumber(val, k, keepDecimals){
  const n = parseFloat(toInternal(val));
  const scaled = n * (10 ** k);
  return rondAf(scaled, keepDecimals);
}

/* =========================================================
   FEEDBACK UI HELPERS
========================================================= */
function setFieldState(el, state) {
  if (!el) return;
  el.classList.remove('input-ok','input-err');
  if (state === 'ok') el.classList.add('input-ok');
  if (state === 'err') el.classList.add('input-err');
}

function showMessages(msgs, ok=false) {
  const box = document.getElementById('feedbackPanel');
  if (!box) return;
  if (!msgs || msgs.length===0) {
    box.innerHTML = "";
    return;
  }
  const cls = ok ? 'ok' : 'err';
  box.innerHTML = msgs.map(m => `<div class="msg ${cls}">${m}</div>`).join("");
}

function showInfo(text){
  const box = document.getElementById('feedbackPanel');
  if (!box) return;
  box.innerHTML = `<div class="msg info">${text}</div>`;
}

function clearFeedbackUI(){
  showMessages([]);
  setFieldState(document.getElementById("inputQuotient"), null);
  setFieldState(document.getElementById("inputRest"), null);
}

/* =========================================================
   OEFENING GENERATORS
========================================================= */
function genereerOefening(level) {
  switch(level) {
    case "1": return genereerBasis();
    case "2": return genereerMakkelijk();
    case "3": return genereerGemiddeld();
    case "4": return genereerMoeilijk();
    case "5": return genereerZeerMoeilijk();
  }
  return genereerBasis();
}

function genereerBasis() {
  const deler = random(2, 9);
  const quotient = random(2, 99);
  const dividend = deler * quotient;
  if (dividend < 10 || dividend > 999) return genereerBasis();
  return { dividend, divisor: deler };
}

function genereerMakkelijk() {
  const deler = random(2, 9);
  const dividend = random(10, 999);
  return { dividend, divisor: deler };
}

function genereerGemiddeld() {
  const deler = random(2, 12);

  // Kies 1 of 2 decimalen voor het DEELTAL.
  const dec = random(1, 2);
  const pow = 10 ** dec;

  for (let tries = 0; tries < 1000; tries++) {
    // 3–4 cijfers vóór de komma houden het niveau netjes
    const intPart = random(100, 9999);          // 100..9999
    const fracPart = random(0, pow - 1);        // 0..9 of 0..99
    const scaled   = intPart * pow + fracPart;  // deeltal × 10^dec
    const dividend = scaled / pow;

    // Zorg dat er (op dec decimalen) een  is:
    if ((scaled % deler) !== 0) {
      return { dividend, divisor: deler };
    }
  }

  // Fallback (zou zelden nodig zijn)
  const fallbackQuot = randomDecimal(1, 300, 2);
  const fallbackDiv  = random(2, 12);
  return { dividend: rondAf(fallbackDiv * fallbackQuot, 2), divisor: fallbackDiv };
}
function genereerMoeilijk() {
  // Deler: geheel getal 2..20 (zoals bij jou)
  const deler = random(2, 20);

  // We willen: dividend met exact 3 decimalen, 4–5 cijfers vóór de komma,
  // en na 3 decimalen nog een rest: ( (dividend * 1000) % deler ) != 0
  const pow = 10 ** 3;

  for (let tries = 0; tries < 2000; tries++) {
    // Kies integer deel zodat we 4–5 cijfers vóór de komma krijgen (1000..99999)
    const intPart = random(1000, 99999);

    // Kies de 3-decimale fractie 000..999
    const frac = random(0, pow - 1);

    const scaled = intPart * pow + frac; // dividend * 1000 (integer)
    const dividend = scaled / pow;

    // Lengte integerdeel: 4–5 cijfers
    const lenInt = String(intPart).length;
    if (lenInt < 4 || lenInt > 5) continue;

    // Zorg voor rest na 3 decimalen tov deler:
    if ((scaled % deler) !== 0) {
      return { dividend, divisor: deler };
    }
  }

  // Fallback (zou zelden nodig zijn)
  const quotient = randomDecimal(1, 500, 3);
  const dividend = rondAf(deler * quotient, 3);
  const len = String(Math.floor(dividend)).length;
  if (len < 4 || len > 5) return genereerMoeilijk(); // herprobeer
  return { dividend, divisor: deler };
}

function genereerZeerMoeilijk(){

  for(let tries = 0; tries < 2000; tries++){

    // deler met 1 of 2 decimalen
    const dec = random(1,2);
    const divisor = Number(randomDecimal(2,10,dec).toFixed(dec));

    // quotiënt met 3 decimalen
    const qInt = random(10000,400000);
    const q = qInt / 1000;

    // rest kleiner dan deler
    const rInt = random(1, Math.floor(divisor*1000)-1);
    const r = rInt / 1000;

    // deeltal en
    let dividend = q*divisor + r;

    // afronden om floating fouten te vermijden
    dividend = Number(dividend.toFixed(3));

    // werkbladlengte controleren
    const len = String(Math.floor(dividend)).length;

    if(len>=3 && len<=5){
      return { dividend, divisor };
    }
  }

  // fallback
  const divisor = Number(randomDecimal(2,10,2).toFixed(2));
  const q = randomDecimal(1,200,3);
  const r = randomDecimal(0.001, divisor-0.001,3);

  const dividend = Number((q*divisor + r).toFixed(3));

  return { dividend, divisor };
}

/* =========================================================
   STAARTDELING STAPPEN
========================================================= */
function berekenDelen(deeltal, deler){
  const chars = toInternal(deeltal).split('');
  const stappen = [];
  const decPos = chars.indexOf(".");

  let rest = 0;
  let gestart = false;
  let digitCol = 0;
  let decimalQuotPos = null;

  function isDigit(ch){ return ch >= '0' && ch <= '9'; }

  function nextDigitChar(i){
    for (let j=i; j<chars.length; j++) if(isDigit(chars[j])) return chars[j];
    return "";
  }

  for(let i=0; i<chars.length; i++){
    const ch = chars[i];

    if(ch === '.'){
      if(decimalQuotPos === null) decimalQuotPos = stappen.length;
      continue;
    }
    if(!isDigit(ch)) continue;

    const cijfer = Number(ch);
    rest = rest*10 + cijfer;

    if(rest >= deler){
      gestart = true;
      const q = Math.floor(rest/deler);
      const product = q*deler;
      const nieuweRest = rest - product;

      const breedte = Math.max(String(rest).length, String(product).length);
      const startKolom = digitCol - breedte + 1;
      const gezakt = nextDigitChar(i+1);

      stappen.push({
        huidig: rest,
        product,
        rest: nieuweRest,
        q,
        startKolom,
        breedte,
        laatsteCijfer: gezakt,
        decimalStap: digitCol === decPos - 1
      });

      rest = nieuweRest;
    }
    else if(gestart){
  const gezakt = nextDigitChar(i+1);

  const breedte = String(rest).length;

  stappen.push({
    huidig: rest,
    product: 0,
    rest: rest,
    q: 0,
    startKolom: digitCol - breedte + 1,
    breedte: breedte,
    laatsteCijfer: gezakt,
    decimalStap: false
     });
   }

    digitCol++;
  }

  if(decimalQuotPos === null) decimalQuotPos = stappen.length;

  return { stappen, decimalQuotPos };
}

/* =========================================================
   ROOSTER
========================================================= */
function random(a,b){
  return Math.floor(Math.random()*(b-a+1))+a;
}

function maakLeegRooster(r,k){
  return Array.from({length:r},()=>Array.from({length:k},
      ()=>({waarde:"",type:""})));
}

function vulRooster(state){
  const stappen = state.stappen;
  if(!stappen.length) return [[{waarde:""}]];

  const kolommen = Math.max(
    ...stappen.map((s,i)=> s.startKolom + s.breedte + (i < stappen.length-1 ? 1 : 0)),
    1
  );

  const rijen = stappen.length * 2;
  const rooster = maakLeegRooster(rijen, kolommen);

  stappen.forEach((stap,index)=>{
    const p = index*2;     // product-rij index
    const a = p+1;         // aftrek-rij index

    const prod = String(stap.product).padStart(stap.breedte,"0");
    const aft  = String(stap.rest).padStart(stap.breedte,"0");

    for(let i=0; i<stap.breedte; i++){
      rooster[p][stap.startKolom+i] = { waarde: prod[i], type: "product" };
    }

    for(let i=0; i<stap.breedte; i++){
      rooster[a][stap.startKolom+i] = { waarde: aft[i], type: "aftrek" };
    }

    if(index < stappen.length-1){
      const col = stap.startKolom + stap.breedte;
      const gez = stap.laatsteCijfer || "";
      rooster[a][col] = { waarde: gez, type: "gezakt" };
    }
  });

  // groene lijn bij Gemiddeld
  if(state.level === "3"){
    const idx = state.stappen.findIndex(s => s.decimalStap);
    if(idx !== -1){
      const stap = state.stappen[idx];
      const col = stap.startKolom + stap.breedte;
      const aftrekRij = idx*2 + 1;

      for(let r = aftrekRij; r < rooster.length; r++){
        const bestaand = rooster[r][col] || { waarde:"", type:"" };
        const nieuwType = (bestaand.type ? (bestaand.type + " ") : "") + "vComma";
        rooster[r][col] = { waarde: bestaand.waarde, type: nieuwType };
      }
    }
  }

  return rooster;
}

/* =========================================================
   UI
========================================================= */
const UI = {
  init(){
  this.cacheDOM();

  // Nakijken-knop
  document.getElementById("btnCheck")
    .addEventListener("click", () => checkAnswersAndFeedback());

  // Zelfcontrole-knop
  document.getElementById("btnSelf")
  .addEventListener("click", () => {
    // Zelfcontrole: géén auto-invulling meer.
    // We tonen enkel een hint + de verwachte kommapositie in het raster.

    // Laat de eigen invoer staan:
    // (NIETS invullen in inputQuotient/inputRest)

    // Toon de verwachte kommapositie (groen streepje / expected)
    state.userDecimalPos = null;           // toon 'expected' stijl in quotient
    UI.tekenQuotient(state.stappen);

    // Toon een duidelijke, leerbevorderende hint
    const exp = expectedAnswer();
    const heeftKomma = exp.qStr.includes(SEP_UI) || toInternal(exp.qStr).includes('.');
    const hintKomma = heeftKomma
      ? "Let op: er hoort een komma in het quotiënt. Bepaal zélf waar die moet komen."
      : "Voor deze oefening is géén komma in het quotiënt nodig.";

    showInfo(
      `Zelfcontrole: kijk je stappen na en verbeter. ${hintKomma}`
    );
  });

  // Nieuwe oefening
  document.getElementById("btnNew")
    .addEventListener("click", startNieuweOefening);

  // Bestaande keydown-handler laten staan (komma-plaatsing)
  document.addEventListener("keydown", (e) => {
  // 1) Als de gebruiker in een invoerveld typt, NIETS onderscheppen:
  const t = e.target;
  const isTextInput =
    t && (
      t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.isContentEditable
    );
  if (isTextInput) return;

  // 2) Alleen buiten invoervelden reageren op komma/punt voor de quotiënt-komma:
  if (e.key === "," || e.key === ".") {
    if (!state.showCommaPlaceholder) return;

    if (state.selectedIndex == null)
      state.selectedIndex = state.decimalQuotPos;

    state.userDecimalPos = state.selectedIndex;
    UI.tekenQuotient(state.stappen);
    e.preventDefault();
  }
});
},

  cacheDOM(){
    this.dividendNode = document.getElementById("grid");
    this.divisorNode  = document.getElementById("divGrid");
    this.quotientNode = document.getElementById("quotientRow");
    this.workAreaNode = document.getElementById("workArea");
  },

  tekenOefening(){
    this.tekenDividend(state.dividend);
    this.tekenDivisor(state.divisor);
    this.tekenQuotient(state.stappen);
    this.tekenworkArea(state);
  },

 tekenDividend(getal){
  const node = this.dividendNode;
  node.innerHTML="";

  const s = toUI(getal);

  const chars = s.split("");
  const cijfers = chars.filter(c=>c>='0' && c<='9');

  node.style.display="grid";
  node.style.gridTemplateColumns=`repeat(${cijfers.length},40px)`;

  let last=null;
  chars.forEach(ch=>{
    if(ch===SEP_UI){
      if(last){
        const punt=document.createElement("span");
        punt.textContent=SEP_UI;
        punt.style.position="absolute";
        punt.style.right="-6px";
        punt.style.bottom="-4px";
        punt.style.fontWeight="bold";
        last.appendChild(punt);
      }
      return;
    }

    const cel=document.createElement("div");
    cel.className="gridcell";
    cel.textContent=ch;
    node.appendChild(cel);
    last=cel;
  });
},
   
  tekenDivisor(getal){
    const node=this.divisorNode;
    node.innerHTML="";
    const s=toUI(getal);
    const chars=s.split("");
    const enkel=chars.filter(c=>c>='0' && c<='9');

    node.style.display="grid";
    node.style.gridTemplateColumns=`repeat(${enkel.length},40px)`;

    let last=null;
    chars.forEach(ch=>{
      if(ch===SEP_UI){
        if(last){
          const punt=document.createElement("span");
          punt.textContent=SEP_UI;
          punt.style=
           "position:absolute;right:-6px;bottom:-4px;font-weight:bold;";
          last.appendChild(punt);
        }
        return;
      }
      const cel=document.createElement("div");
      cel.className="gridcell";
      cel.textContent=ch;
      node.appendChild(cel);
      last=cel;
    });
  },

  tekenQuotient(stappen){
    const node=this.quotientNode;
    node.innerHTML="";

    const digitsCount = stappen.length;
    const showComma = state.showCommaPlaceholder;

    const commaPos = showComma
      ? (state.userDecimalPos ?? state.decimalQuotPos)
      : null;

    const totalCols = digitsCount + (showComma ? 1 : 0);

    node.style.display="grid";
    node.style.gridTemplateColumns=`repeat(${totalCols},40px)`;

    let digitPtr=0;

    for(let pos=0; pos<=digitsCount; pos++){

      if(showComma && pos===commaPos){
        const cel=document.createElement("div");
        cel.className="gridcell comma";
        cel.textContent=",";
        cel.classList.add(
          state.userDecimalPos==null ? "expected" : "userPlaced"
        );
        node.appendChild(cel);
      }

      if(digitPtr < digitsCount){
        const cel=document.createElement("div");
        cel.className="gridcell";
        cel.textContent = stappen[digitPtr].q;

        cel.addEventListener("click",()=>{
          state.selectedIndex = pos;
          this.tekenQuotient(stappen);
        });

        if(state.selectedIndex===pos)
          cel.classList.add("sel");

        node.appendChild(cel);
        digitPtr++;
      }
    }
  },

  tekenworkArea(state){
    const node=this.workAreaNode;
    node.innerHTML="";

    const rooster = vulRooster(state);
    const rows = rooster.length;
    const cols = Math.max(...rooster.map(r=>r.length));

    node.style.display="grid";
    node.style.gridTemplateColumns=`repeat(${cols},40px)`;
    node.style.gridTemplateRows=`repeat(${rows},40px)`;

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const celData = rooster[r][c] || {waarde:"",type:""};
        const cel=document.createElement("div");
        cel.className="gridcell";
        cel.textContent = celData.waarde;

        if(celData.type){
          const parts = celData.type.split(" ");
          parts.forEach(t=>{ if(t.trim()) cel.classList.add(t.trim()); });
        }

        node.appendChild(cel);
      }
    }
  }
};

/* =========================================================
   ANTWOORDVELDEN
========================================================= */
function resetAnswerInputs(){
  const q=document.getElementById("inputQuotient");
  const r=document.getElementById("inputRest");
  if(q) q.value="";
  if(r) r.value="";
}

function fillCorrectAnswers(){
  const q = document.getElementById("inputQuotient");
  const r = document.getElementById("inputRest");
  if(!q || !r) return;

  if (state.level === "1" || state.level === "2"){
    const qInt = Math.floor(state.dividend / state.divisor);
    const rInt = state.dividend - qInt * state.divisor;
    q.value = String(qInt);
    r.value = String(rInt);
    return;
  }

  if (state.level === "3"){
    // Zelfde aantal decimalen als het DEELTAL (0, 1 of 2), trunceren
    const decQ = decimalPlaces(state.dividend);
    const { q: qDec, r: rDec } = divMetVasteDecimalen(state.dividend, state.divisor, decQ);
    q.value = toUI(qDec.toFixed(decQ));
    r.value = toUI(rDec.toFixed(decQ));
    return;
  }

  if (state.level === "4"){
    // Vaste precisie: 3 decimalen (trunc), rest op 3 decimalen
    const { q: qDec, r: rDec } = divMetVasteDecimalen(state.dividend, state.divisor, 3);
    q.value = toUI(qDec.toFixed(3));
    r.value = toUI(rDec.toFixed(3));
    return;
  }

  else if (state.level === "5"){

  const steps = state.stappen;

  // quotient exact zoals in het werkveld
  let qStr = steps.map(s => s.q).join("");

  if(state.decimalQuotPos !== null){
    qStr =
      qStr.slice(0, state.decimalQuotPos) +
      "." +
      qStr.slice(state.decimalQuotPos);
  }

  const qVal = parseFloat(qStr);

  const D = state.originalDividend;
  const d = state.originalDivisor;

  const rVal = Number((D - qVal * d).toFixed(10));

  q.value = toUI(qVal);
  r.value = toUI(rVal);

  return;
   }
}

/* =========================================================
   VERWACHT ANTWOORD PER NIVEAU (zonder invullen)
========================================================= */
function expectedAnswer() {
  const level = state.level;
  const D = state.dividend;
  const d = state.divisor;

  if (level === "1" || level === "2") {
    const qInt = Math.floor(D / d);
    const rInt = D - qInt * d;
    return { qStr: toUI(String(qInt)), rStr: toUI(String(rInt)), decimals: 0 };
  }

  if (level === "3") {
    const decQ = decimalPlaces(D);
    const { q: qDec, r: rDec } = divMetVasteDecimalen(D, d, decQ);
    return { qStr: toUI(qDec.toFixed(decQ)), rStr: toUI(rDec.toFixed(decQ)), decimals: decQ };
  }

  if (level === "4") {
    const { q: qDec, r: rDec } = divMetVasteDecimalen(D, d, 3);
    return { qStr: toUI(qDec.toFixed(3)), rStr: toUI(rDec.toFixed(3)), decimals: 3 };
  }

  // level 5: volgens werkveld (stappen + originele schaal)
  if (level === "5") {
    let qWork = state.stappen.map(s => s.q).join("");
    if (state.decimalQuotPos !== null) {
      qWork = qWork.slice(0, state.decimalQuotPos) + "." + qWork.slice(state.decimalQuotPos);
    }
    const qVal = parseFloat(qWork);
    const D0 = state.originalDividend;
    const d0 = state.originalDivisor;
    const rVal = Number((D0 - qVal * d0).toFixed(10));
    return { qStr: toUI(String(qVal)), rStr: toUI(String(rVal)), decimals: -1 }; // -1 = geen vaste afronding
  }

  // fallback
  return { qStr: "", rStr: "" };
}

/* =========================================================
   NAKIJKEN: verzamel fouten en toon feedback
========================================================= */
function checkAnswersAndFeedback() {
  const level = state.level;

  const qEl = document.getElementById("inputQuotient");
  const rEl = document.getElementById("inputRest");
  const qInRaw = qEl ? qEl.value.trim() : "";
  const rInRaw = rEl ? rEl.value.trim() : "";

  const exp = expectedAnswer();

  const errors = [];

  // ---------- 0) Normaliseer invoer ----------
  const qInHasComma = /[.,]/.test(qInRaw);     // leerling heeft een komma/punt gezet
  // const rInHasValue = rInRaw !== "";         // (optioneel; niet nodig in de logica hieronder)

  const qUser = qInRaw === "" ? null : parseLearnerNumber(qInRaw);
  const rUser = rInRaw === "" ? null : parseLearnerNumber(rInRaw);

  const qExp  = parseLearnerNumber(exp.qStr);
  const rExp  = parseLearnerNumber(exp.rStr);

  // ---------- 1) Eerst leeg-invoer afhandelen (prioriteit) ----------
  if (qUser == null) {
    errors.push("INVOER_QUOTIENT_LEEG");
  }
  // Rest: alleen foutmelding als er echt iets verwacht wordt
  if (rUser == null) {
    if (rExp != null && Math.abs(rExp) > 1e-12) {
      // Er is wél een rest verwacht, maar niks ingevuld
      errors.push("INVOER_REST_LEEG");
    } else {
      // Verwachte rest is 0, leeg = ok -> geen fout
    }
  }

  // ---------- 2) Komma-controle ----------
  // Komma telt als aanwezig als OF:
  // - de leerling in het antwoordveld een komma/punt heeft gezet, OF
  // - de leerling via het raster een komma plaatste (userDecimalPos != null)
  const expNeedsComma = (exp.qStr.includes(SEP_UI) || toInternal(exp.qStr).includes('.'));
  const userHasComma = qInHasComma || (state.userDecimalPos != null);

  if (expNeedsComma && !userHasComma) {
    errors.push("KOMMA_NIET");
  } else if (expNeedsComma && userHasComma) {
    // Alleen positie checken als de leerling de raster-komma gebruikte
    if (state.userDecimalPos != null && state.userDecimalPos !== state.decimalQuotPos) {
      errors.push("KOMMA_FOUT");
    }
    // Komma uitsluitend in het antwoordveld? Dan accepteren we zonder positiecheck.
  }

  // ---------- 3) Inhoudelijke checks PAS als de velden niet leeg zijn ----------
  if (qUser != null && qExp != null && Math.abs(qUser - qExp) > 1e-12) {
    errors.push("VERDEEL_FOUT"); // inhoudelijk fout of overnamefout in quotiënt
  }
  if (rUser != null && rExp != null && Math.abs(rUser - rExp) > 1e-9) {
    errors.push("REST_FOUT");    // inhoudelijk fout of overnamefout in rest
  }

  // ---------- 4) UI-uitvoer ----------
  if (errors.length === 0) {
    setFieldState(qEl, 'ok');
    setFieldState(rEl, 'ok');
    showMessages(["Knap! Alles is correct."], true);
    return;
  }

  // Velden rood markeren alleen voor fouten die dat veld raken
  setFieldState(
    qEl,
    (errors.includes("INVOER_QUOTIENT_LEEG") || errors.includes("VERDEEL_FOUT")) ? 'err' : null
  );
  setFieldState(
    rEl,
    (errors.includes("INVOER_REST_LEEG") || errors.includes("REST_FOUT")) ? 'err' : null
  );

  // Tekst per niveau
  if (level === "4") {
    showMessages([]);  // alleen kleur
  } else if (level === "5") {
    showMessages([]);  // niets tonen
  } else {
    // Niveaus 1..3: toon inhoudelijke feedback, voorkom dubbele meldingen
    const msgs = [];
    const filtered = new Set(errors);

    if (filtered.has("INVOER_QUOTIENT_LEEG")) {
      filtered.delete("VERDEEL_FOUT");
    }
    if (filtered.has("INVOER_REST_LEEG")) {
      filtered.delete("REST_FOUT");
    }

    for (const code of filtered) {
      if (FEEDBACK[code]) msgs.push( feedbackText(code, level) );
    }
    showMessages(msgs);
  }
}

/* =========================================================
   START NIEUWE OEFENING
========================================================= */
function startNieuweOefening(){
  const diff=document.getElementById("difficulty").value;
  state.level=diff;
  state.decimalReminderShown=false;

  const oef = genereerOefening(diff);

  let deeltal=oef.dividend;
  let deler=oef.divisor;

  state.originalDividend=deeltal;
  state.originalDivisor=deler;

  if(diff==="5"){
    const k=decimalPlaces(deler);
    if(k>0){
      const keep=Math.max(0,CONFIG.maxDecimalen-k);
      deeltal = scaleNumber(deeltal,k,keep);
      deler   = Math.round(parseFloat(toInternal(deler))*(10**k));
    }
  }

  state.dividend=deeltal;
  state.divisor=deler;

  const res=berekenDelen(deeltal,deler);
  state.stappen=res.stappen;
  state.decimalQuotPos=res.decimalQuotPos;
  state.userDecimalPos=null;
  state.selectedIndex=res.decimalQuotPos;

  const showDiv = toInternal(deeltal).includes(".");
  const showDer = toInternal(deler).includes(".");
  state.showCommaPlaceholder = showDiv || showDer;

  state.decimalDividendPos=toInternal(deeltal).indexOf(".");

  const opgaveTekst = (diff==="5")
    ? `${toUI(state.originalDividend)} : ${toUI(state.originalDivisor)} =`
    : `${toUI(deeltal)} : ${toUI(deler)} =`;

  document.getElementById("opgaveTekst").textContent = opgaveTekst;

  resetAnswerInputs();
   clearFeedbackUI();      // wis oude feedback
   // fillCorrectAnswers();  // NIET automatisch: alleen via “Zelfcontrole”

   UI.tekenOefening();
}

/* =========================================================
   BOOTSTRAP
========================================================= */
window.addEventListener("DOMContentLoaded",()=>{
  UI.init();
  startNieuweOefening();
});
