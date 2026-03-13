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
  },
   // ► In je bestaande FEEDBACK-object, voeg toe:
   STEP_Q_FOUT: {
  1: "Stap {i}: het quotiëntcijfer klopt niet. Bepaal hoeveel keer de deler past in het huidige getal.",
  2: "Stap {i}: controleer je quotiëntcijfer.",
  3: "Stap {i}: quotiëntcijfer fout."
},
   STEP_PRODUCT_FOUT: {
  1: "Stap {i}: het product (quotiënt × deler) klopt niet. Reken de vermenigvuldiging opnieuw.",
  2: "Stap {i}: controleer het product.",
  3: "Stap {i}: product fout."
},
   STEP_AFTREK_FOUT: {
  1: "Stap {i}: de aftrekking (verschil) klopt niet. Reken opnieuw: huidig getal − product.",
  2: "Stap {i}: controleer je aftrekking.",
  3: "Stap {i}: aftrek fout."
},
   STEP_ZAKKEN_ONTBREEKT: {
  1: "Stap {i}: je hebt geen cijfer laten zakken, terwijl dat wel moet.",
  2: "Stap {i}: cijfer laten zakken ontbreekt.",
  3: "Stap {i}: zakken ontbreekt."
},
   STEP_ZAKKEN_FOUT: {
  1: "Stap {i}: je liet het verkeerde cijfer zakken. Neem het volgende cijfer van het deeltal.",
  2: "Stap {i}: controleer het gezakte cijfer.",
  3: "Stap {i}: zakken fout."
}
};

// ► Plak deze helper ONDER het FEEDBACK-blok:
function msg(fmt, i) { 
  return fmt.replace("{i}", (i+1));  // i=0 → "Stap 1"
}

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

  // --- NIEUW voor stap-voor-stap ---
  stepMode: false,
  userSteps: [],
   userGrid: [],   // 2D-array met leerlinginvoer per rooster-cel


  level: "1",
  instellingen: { decimalen: false, controle: false },

  showCommaPlaceholder: false,
  decimalReminderShown: false,
   revealQuotient: false,   // toon géén quotiëntcijfers bij start
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
    if(idx !== -1 && typeof aftrekVolledigIngevuld === "function" && aftrekVolledigIngevuld(idx)){
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

function aftrekVolledigIngevuld(stapIndex){
  const rooster = vulRooster(state);
  const stap = state.stappen[stapIndex];

  const rij = stapIndex*2 + 1; // aftrekrij

  for(let i=0;i<stap.breedte;i++){
    const col = stap.startKolom+i;
    const v = state.userGrid?.[rij]?.[col];
    if(!v || v.trim()==="") return false;
  }
  return true;
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

   // --- Stap-modus aan/uit (rooster invulbaar maken) ---
const chk = document.getElementById("chkStepMode");
if (chk) {
  chk.addEventListener("change", () => {
    state.stepMode = chk.checked;
    if (state.stepMode) {
      initUserGrid();
    }
    // Tekenen met (of zonder) invulbare cellen
    UI.tekenworkArea(state);
  });
}
     
  // Bestaande keydown-handler laten staan (komma-plaatsing)
  document.addEventListener("keydown", (e) => {
  // 1) Typ de komma/punt NIET onderscheppen als gebruiker in een invoerveld bezig is
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
   // Nakijk werkblad (rooster)
   const btnSteps = document.getElementById("btnCheckSteps");
   if (btnSteps) {
  btnSteps.addEventListener("click", () => checkWorkGrid());
   }
     
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
  const node = this.quotientNode;
  node.innerHTML = "";

  const digitsCount = stappen.length;

  // Als we (nog) niets willen tonen: teken lege cellen, zonder komma
  if (!state.revealQuotient) {
  node.style.display = "grid";
  node.style.gridTemplateColumns = `repeat(${digitsCount},40px)`;

  if(!state.userQuotient){
    state.userQuotient = Array(digitsCount).fill("");
  }

  for (let i = 0; i < digitsCount; i++) {
    const cel = document.createElement("div");
    cel.className = "gridcell";
    cel.contentEditable = true;

    cel.textContent = state.userQuotient[i] || "";

    cel.addEventListener("input", e=>{
      let v = e.currentTarget.textContent.replace(/\D/g,"");
      if(v.length>1) v=v.slice(-1);
      e.currentTarget.textContent=v;
      state.userQuotient[i]=v;
    });

    node.appendChild(cel);
  }

  return;
}

  // --- Anders: de bestaande weergave (met cijfers en evt. komma) ---
  const showComma = state.showCommaPlaceholder;

  const commaPos = showComma
    ? (state.userDecimalPos ?? state.decimalQuotPos)
    : null;

  const totalCols = digitsCount + (showComma ? 1 : 0);

  node.style.display = "grid";
  node.style.gridTemplateColumns = `repeat(${totalCols},40px)`;

  let digitPtr = 0;

  for (let pos = 0; pos <= digitsCount; pos++) {

    if (showComma && pos === commaPos) {
      const cel = document.createElement("div");
      cel.className = "gridcell comma";
      cel.textContent = ",";
      cel.classList.add(
        state.userDecimalPos == null ? "expected" : "userPlaced"
      );
      node.appendChild(cel);
    }

    if (digitPtr < digitsCount) {
      const cel = document.createElement("div");
      cel.className = "gridcell";
      cel.textContent = stappen[digitPtr].q;

      cel.addEventListener("click", () => {
        state.selectedIndex = pos;
        this.tekenQuotient(stappen);
      });

      if (state.selectedIndex === pos)
        cel.classList.add("sel");

      node.appendChild(cel);
      digitPtr++;
    }
  }
},

  tekenworkArea(state){
  const node = this.workAreaNode;
  node.innerHTML = "";

  const rooster = vulRooster(state);
  const rows = rooster.length;
  const cols = Math.max(...rooster.map(r => r.length));

  node.style.display = "grid";
  node.style.gridTemplateColumns = `repeat(${cols},40px)`;
  node.style.gridTemplateRows = `repeat(${rows},40px)`;

  // Als stap-modus aan staat ➜ userGrid moet juiste maat hebben
  if (!state.userGrid || state.userGrid.length !== rows) {
  initUserGrid();
   }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const celData = (rooster[r][c]) || { waarde:"", type:"" };
      const cel = document.createElement("div");
      cel.className = "gridcell";

      // type(s) zoals "product", "aftrek", "gezakt"
      if (celData.type) {

  const parts = celData.type.split(" ");

  parts.forEach(t => {

    if(!t.trim()) return;

    // speciale behandeling voor groene komma-lijn
    if(t==="vComma"){
      const idx = state.stappen.findIndex(s=>s.decimalStap);
      if(idx!==-1 && aftrekVolledigIngevuld(idx)){
        cel.classList.add("vComma");
      }
    }
    else{
      cel.classList.add(t.trim());
    }

  });
}

      const mainType = (celData.type || "").split(" ")[0];

      // --- NIEUW: aftreklijn pas tonen wanneer product is ingevuld ---
      if (mainType === "aftrek") {
        const stepIndex = Math.floor(r / 2);
        const productRow = stepIndex * 2;
        if (!anyInputInRow(productRow)) {
          cel.classList.remove("aftrek"); // dikke streep weghalen
        }
      }

      const editable = /^(product|aftrek|gezakt)$/.test(mainType);

      if (editable) {
        // Leerling kan hier typen
        cel.contentEditable = "true";

        const v = state.userGrid[r]?.[c] ?? "";
        cel.textContent = v;

        cel.dataset.r = r;
        cel.dataset.c = c;

        cel.addEventListener("beforeinput", e => {
          if (e.inputType === "insertText" && !/^[0-9]$/.test(e.data)) {
            e.preventDefault();
          }
        });

        cel.addEventListener("input", e => {
          let txt = e.currentTarget.textContent.replace(/\D/g,"");
          if (txt.length > 1) txt = txt.slice(-1);
          e.currentTarget.textContent = txt;
          state.userGrid[r][c] = txt;

           UI.tekenworkArea(state);
        });

      } else {
        // Niet invulbaar → werkveld leeg houden
        if (mainType === "product" || mainType === "aftrek" || mainType === "gezakt") {
          cel.textContent = "";
        } else {
          cel.textContent = celData.waarde; // enkel voor dividend / divisor
        }
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
   STAP-MODUS: data en UI (opbouw invulvelden)
========================================================= */

// 1) Maak per stap een lege invoerstructuur voor de leerling
function initUserSteps() {
  // 1 object per stap met lege strings; leerling vult dit in
  state.userSteps = state.stappen.map(() => ({
    q: "",        // quotiëntcijfer voor deze stap
    product: "",  // product = q × deler
    rest: "",     // resultaat na aftrekken
    zak: ""       // gezakt cijfer (alleen indien van toepassing)
  }));
}

// 2) Bouw de rijen "Stap 1, Stap 2, ..." met vier invoervelden
function renderStepInputs() {
  const wrap = document.getElementById("stepInputs");
  if (!wrap) return;

  // Toon of verberg het hele paneel op basis van de checkbox
  wrap.hidden = !state.stepMode;
  if (!state.stepMode) return;

  // Voor elke stap in state.stappen bouwen we een rij
  const rows = state.stappen.map((stap, i) => {
    // Moet er na deze stap een cijfer gezakt worden?
    const mustDrop = (i < state.stappen.length - 1) && (stap.laatsteCijfer !== "");

    return `
      <div class="stepRow" data-i="${i}">
        <div class="stepHead">Stap ${i+1}</div>
        <input class="stepInput" id="step-q-${i}" inputmode="numeric" placeholder="q" value="${state.userSteps[i].q}">
        <input class="stepInput" id="step-p-${i}" inputmode="numeric" placeholder="product" value="${state.userSteps[i].product}">
        <input class="stepInput" id="step-r-${i}" inputmode="numeric" placeholder="aftrek/rest" value="${state.userSteps[i].rest}">
        <input class="stepInput" id="step-z-${i}" inputmode="numeric" placeholder="zakken" value="${state.userSteps[i].zak}" ${mustDrop ? "" : "disabled"}>
      </div>
      ${mustDrop ? `<div class="mini">Tip: in deze stap moet je het volgende cijfer laten zakken.</div>` : ""}
    `;
  }).join("");

  // Header + alle rijen plaatsen
  wrap.innerHTML = `
    <div class="mini" style="margin-bottom:6px;">
      Vul per stap het <b>quotiëntcijfer</b>, het <b>product</b> (quotiënt × deler), de <b>aftrek/rest</b> en (indien nodig) het <b>gezakte cijfer</b> in.
    </div>
    ${rows}
  `;

  // Inputs laten "schrijven" in state.userSteps zodat we later kunnen nakijken
  state.stappen.forEach((_, i) => {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        state.userSteps[i][key] = el.value.trim();
      });
    };
    bind(`step-q-${i}`, "q");
    bind(`step-p-${i}`, "product");
    bind(`step-r-${i}`, "rest");
    bind(`step-z-${i}`, "zak");
  });
}

/* =========================================================
   STAP-MODUS: nakijken per stap
========================================================= */
function markStepField(i, kind, ok) {
  const el = document.getElementById(`step-${kind}-${i}`);
  if (!el) return;
  el.classList.remove("step-ok","step-err");
  el.classList.add(ok ? "step-ok" : "step-err");
}

function clearStepMarks() {
  state.stappen.forEach((_, i) => {
    ["q","p","r","z"].forEach(kind => {
      const el = document.getElementById(`step-${kind}-${i}`);
      if (el) el.classList.remove("step-ok","step-err");
    });
  });
}

function checkWorkSteps() {
  const level = state.level;
  const msgs = [];

  clearStepMarks();

  state.stappen.forEach((s, i) => {
    // Verwachte waarden uit je berekende stappen
    const expQ   = Number(s.q);         // 1 cijfer
    const expP   = Number(s.product);   // product
    const expR   = Number(s.rest);      // verschil/rest
    const expZak = (i < state.stappen.length - 1) ? (s.laatsteCijfer || "") : ""; // string

    // Invoer van leerling
    const get = (key) => (state.userSteps[i] && state.userSteps[i][key]) ? state.userSteps[i][key].trim() : "";
    const uQraw = get("q");
    const uPraw = get("product");
    const uRraw = get("rest");
    const uZraw = get("zak");

    // Helpers
    const has = v => v !== null && v !== undefined && String(v).trim() !== "";
    const num = v => parseLearnerNumber(v);  // accepteert komma of punt

    // 1) quotiëntcijfer
    if (has(uQraw)) {
      const ok = Number(num(uQraw)) === expQ;
      markStepField(i, "q", ok);
      if (!ok && level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_Q_FOUT[level], i) );
    } else {
      markStepField(i, "q", false);
      if (level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_Q_FOUT[level], i) );
    }

    // 2) product (vermenigvuldigen)
    if (has(uPraw)) {
      const ok = Number(num(uPraw)) === expP;
      markStepField(i, "p", ok);
      if (!ok && level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_PRODUCT_FOUT[level], i) );
    } else {
      markStepField(i, "p", false);
      if (level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_PRODUCT_FOUT[level], i) );
    }

    // 3) aftrek/rest
    if (has(uRraw)) {
      const ok = Number(num(uRraw)) === expR;
      markStepField(i, "r", ok);
      if (!ok && level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_AFTREK_FOUT[level], i) );
    } else {
      markStepField(i, "r", false);
      if (level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_AFTREK_FOUT[level], i) );
    }

    // 4) zakken (alleen als het moet)
    const mustDrop = expZak !== "";
    if (mustDrop) {
      if (!has(uZraw)) {
        markStepField(i, "z", false);
        if (level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_ZAKKEN_ONTBREEKT[level], i) );
      } else {
        const ok = String(uZraw) === String(expZak);
        markStepField(i, "z", ok);
        if (!ok && level !== "5" && level !== "4") msgs.push( msg(FEEDBACK.STEP_ZAKKEN_FOUT[level], i) );
      }
    }
  });

  // Tekstoutput per niveau
  if (level === "4") {
    // Alleen kleuren
    return showMessages([]);
  }
  if (level === "5") {
    // Geen tekst
    return showMessages([]);
  }

  // Niveau 1–3
  showMessages(msgs.length ? msgs : ["Knap! Alles klopt."], msgs.length === 0);
}

/* =========================================================
   Rooster-invoer voorbereiden (zelfde maat als verwacht rooster)
========================================================= */
function initUserGrid() {
  const rooster = vulRooster(state);
  const rows = rooster.length;
  const cols = Math.max(...rooster.map(r => r.length));
  state.userGrid = Array.from({length: rows}, () => Array.from({length: cols}, () => ""));
}

/* =========================================================
   Nakijken in het rooster (cel per cel)
========================================================= */
function clearGridMarks(){
  const node = UI.workAreaNode;
  if (!node) return;
  [...node.children].forEach(el => el.classList && el.classList.remove("cell-ok","cell-err"));
}

function checkWorkGrid() {
  const level = state.level;

  const rooster = vulRooster(state);
  const rows = rooster.length;
  const cols = Math.max(...rooster.map(r => r.length));

  clearGridMarks();

  const node = UI.workAreaNode;
  const msgs = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const celData = (rooster[r][c]) || { waarde:"", type:"" };
      const mainType = (celData.type || "").split(" ")[0];
      const isCheckType = /^(product|aftrek|gezakt)$/.test(mainType);
      if (!isCheckType) continue;

      const exp = String(celData.waarde || "");
      const usr = (state.userGrid[r] && state.userGrid[r][c] != null) ? String(state.userGrid[r][c]) : "";

      const ok = (usr === exp);

      // DOM-cel ophalen en kleuren
      const domIndex = r*cols + c; // omdat we grid cellen in rijvolgorde append'en
      const domCell = node.children[domIndex];
      if (domCell) {
        domCell.classList.add(ok ? "cell-ok" : "cell-err");
      }

      // Tekstfeedback (alleen niveau 1..3), 1 melding per stap/type is genoeg
      if (!ok && level !== "4" && level !== "5") {
        const stapIndex = Math.floor(r/2); // product/ aftrek-rij per stap
        if (mainType === "product" && FEEDBACK.STEP_PRODUCT_FOUT) {
          msgs.push( msg(FEEDBACK.STEP_PRODUCT_FOUT[level], stapIndex) );
        }
        if (mainType === "aftrek" && FEEDBACK.STEP_AFTREK_FOUT) {
          msgs.push( msg(FEEDBACK.STEP_AFTREK_FOUT[level], stapIndex) );
        }
        if (mainType === "gezakt" && FEEDBACK.STEP_ZAKKEN_FOUT) {
          msgs.push( msg(FEEDBACK.STEP_ZAKKEN_FOUT[level], stapIndex) );
        }
      }
    }
  }

  // Dubbels weghalen
  const unique = [...new Set(msgs)];

  if (level === "4" || level === "5") {
    showMessages([]); // alleen kleuren of niets
  } else {
    showMessages(unique.length ? unique : ["Knap! Alles klopt."], unique.length === 0);
  }
}

function anyInputInRow(rowIndex) {
  const grid = state.userGrid || [];
  if (!grid[rowIndex]) return false;
  return grid[rowIndex].some(v => v != null && String(v).trim() !== "");
}
/* =========================================================
   START NIEUWE OEFENING
========================================================= */
function startNieuweOefening(){
  const diff = document.getElementById("difficulty").value;
  state.level = diff;
  state.decimalReminderShown = false;

  const oef = genereerOefening(diff);

  let deeltal = oef.dividend;
  let deler   = oef.divisor;

  state.originalDividend = deeltal;
  state.originalDivisor  = deler;

  // Niveau 5: intern schalen (zoals jij al had)
  if (diff === "5") {
    const k = decimalPlaces(deler);
    if (k > 0) {
      const keep = Math.max(0, CONFIG.maxDecimalen - k);
      deeltal = scaleNumber(deeltal, k, keep);
      deler   = Math.round(parseFloat(toInternal(deler)) * (10 ** k));
    }
  }

  state.dividend = deeltal;
  state.divisor  = deler;

  // Bereken stappen en komma‑positie (worden gebruikt voor feedback/tekenen)
  const res = berekenDelen(deeltal, deler);
  state.stappen         = res.stappen;
  state.decimalQuotPos  = res.decimalQuotPos;
  state.userDecimalPos  = null;                 // eigen komma nog niet gezet
   state.userQuotient = [];
  state.selectedIndex   = res.decimalQuotPos;

  const showDiv = toInternal(deeltal).includes(".");
  const showDer = toInternal(deler).includes(".");
  state.showCommaPlaceholder = showDiv || showDer;

  state.decimalDividendPos = toInternal(deeltal).indexOf(".");

  // Opgavetekst (niveau 5 toont originele schaal)
  const opgaveTekst = (diff === "5")
    ? `${toUI(state.originalDividend)} : ${toUI(state.originalDivisor)} =`
    : `${toUI(deeltal)} : ${toUI(deler)} =`;
  document.getElementById("opgaveTekst").textContent = opgaveTekst;

  // Antwoordvelden leeg + feedback leeg
  resetAnswerInputs();
  clearFeedbackUI();
  document.getElementById("inputQuotient").value = "";
  document.getElementById("inputRest").value = "";

  // --- BELANGRIJK: quotiëntrij leeg houden bij het tekenen ---
  state.revealQuotient = false;   // <<< HIER zetten we 'm uit
  state.userDecimalPos = null;    // nog geen komma in quotiënt

  // (optioneel) als je stap‑modus gebruikt met invulrooster:
  if (state.stepMode && typeof initUserGrid === "function") {
    initUserGrid();               // leeg invulrooster met juiste afmeting
  }

  // Nu pas tekenen (grid, divisor, dividend, lege quotiënt en leeg werkveld)
  UI.tekenOefening();

  // Als je ook het oude stepInputs‑paneel gebruikt:
  if (state.stepMode && typeof initUserSteps === "function" && typeof renderStepInputs === "function") {
    initUserSteps();
    renderStepInputs();
  }
}

/* =========================================================
   BOOTSTRAP
========================================================= */
window.addEventListener("DOMContentLoaded",()=>{
  UI.init();
  startNieuweOefening();
});
