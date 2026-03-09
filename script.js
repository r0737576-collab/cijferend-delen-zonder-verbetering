"use strict";
console.log("SCRIPT START");

/* =========================================================
   Locale helpers
========================================================= */
const SEP_UI = ','; // UI toont komma

function toInternal(val) {
  // alles intern met punt
  return String(val).replace(',', '.');
}

function toUI(val) {
  // alles voor de leerling met komma
  return String(val).replace('.', SEP_UI);
}

function parseLearnerNumber(s) {
  const n = parseFloat(toInternal(s));
  return Number.isFinite(n) ? n : null;
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
   STATE
========================================================= */
const state = {
  dividend: 0,
  divisor: 0,
  stappen: [],
  level: "1", // "1"=Basis, "2"=Makkelijk, "3"=Gemiddeld, "4"=Moeilijk, "5"=Zeer moeilijk
  instellingen: {
    decimalen: false,
    controle: false
  },
  showCommaPlaceholder: false,   // wel/niet komma-cel in quotiënt tonen
  decimalReminderShown: false,   // (gereserveerd, niet actief)
  selectedIndex: null,           // positie waar de leerling wil typen (0..#cijfers)
  decimalQuotPos: null,          // verwachte komma-positie
  userDecimalPos: null,          // werkelijk geplaatste komma-positie
  decimalDividendPos: null,      // index van '.' in deeltal-string (intern)
  originalDividend: null,        // voor opgave bovenaan
  originalDivisor: null          // voor opgave bovenaan
};

/* =========================================================
   WISKUNDE: Hulpfuncties
========================================================= */
function rondAf(getal, decimals) {
  return Number(getal.toFixed(decimals));
}

function randomDecimal(min, max, dec) {
  const factor = 10 ** dec;
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
}

// Hoeveel decimalen heeft een (string/number) getal?
function decimalPlaces(val){
  const s = toInternal(val);
  const i = s.indexOf('.');
  return i === -1 ? 0 : (s.length - i - 1);
}

// Vermenigvuldig met 10^k en rond af op 'keepDecimals' decimalen
function scaleNumber(val, k, keepDecimals){
  const n = parseFloat(toInternal(val));
  const factor = 10 ** k;
  const scaled = n * factor;
  return rondAf(scaled, keepDecimals);
}

/* =========================================================
   GENERATOREN
========================================================= */
/* 1. BASIS — komt uit, 2–3 cijfers, deler ≤ 9 */
function genereerBasis() {
  const deler = random(2, 9);
  const quotient = random(2, 99);
  const dividend = deler * quotient;

  if (dividend < 10 || dividend > 999) {
    return genereerBasis();
  }
  return { dividend, divisor: deler };
}

/* 2. MAKKELIJK — mag rest hebben, 2–3 cijfers, deler ≤ 9 */
function genereerMakkelijk() {
  const deler = random(2, 9);
  const dividend = random(10, 999);
  return { dividend, divisor: deler };
}

/* 3. GEMIDDELD — tot 2 decimalen, 3–4 cijfers, deler ≤ 12, komt uit */
function genereerGemiddeld() {
  const deler = random(2, 12);
  while (true) {
    const quotient = randomDecimal(1, 300, 2);
    let dividend = rondAf(deler * quotient, 2);
    const intLen = String(Math.floor(dividend)).length;
    if (intLen >= 3 && intLen <= 4) {
      return { dividend, divisor: deler };
    }
  }
}

/* 4. MOEILIJK — tot 3 decimalen, 4–5 cijfers, deler ≤ 20, komt uit */
function genereerMoeilijk() {
  const deler = random(2, 20);
  const quotient = randomDecimal(1, 500, 3);
  let dividend = rondAf(deler * quotient, 3);

  const intLen = String(Math.floor(dividend)).length;
  if (intLen < 4 || intLen > 5) {
    return genereerMoeilijk();
  }
  return { dividend, divisor: deler };
}

/* 5. ZEER MOEILIJK
   → DELER: tussen 2 en 10 (max 2 decimalen)
   → Deeltal 3–5 cijfers (vóór de komma), tot 3 decimalen
   → komt altijd uit
*/
function genereerZeerMoeilijk() {
  // Deler in [2, 10], tot 2 decimalen
  const deler = randomDecimal(2, 10, 2);
  // Quotiënt kan decimalen hebben
  const quotient = randomDecimal(1, 500, 3);
  // Dividend
  let dividend = rondAf(deler * quotient, 3);

  const intLen = String(Math.floor(dividend)).length;
  if (intLen < 3 || intLen > 5) {
    return genereerZeerMoeilijk();
  }
  return { dividend, divisor: deler };
}

/* =========================================================
   STAARTDELING STAPPEN
========================================================= */
function berekenDelen(deeltal, deler){
  const chars = toInternal(deeltal).split('');
  const stappen = [];
  const decimalDividendPos = chars.indexOf(".");

  let rest = 0;
  let gestart = false;
  let digitCol = 0;          // echte kolomteller (ENKEL cijfers tellen!)
  let decimalQuotPos = null; // waar hoort de komma in quotient

  function isDigit(ch){
    return ch >= '0' && ch <= '9';
  }

  function nextDigitChar(fromIdx){
    for(let j = fromIdx; j < chars.length; j++){
      if(isDigit(chars[j])) return chars[j];
    }
    return "";
  }

  for(let i = 0; i < chars.length; i++){
    const ch = chars[i];

    // punt/komma bepaalt enkel quotiënt-positie
    if(ch === '.'){
      if(decimalQuotPos === null) decimalQuotPos = stappen.length;
      continue;
    }

    if(!isDigit(ch)) continue;

    const cijfer = Number(ch);
    rest = rest * 10 + cijfer;

    if(rest >= deler){
      gestart = true;

      const q = Math.floor(rest / deler);
      const product = q * deler;
      const nieuweRest = rest - product;

      const huidigGetal = rest;
      const breedte = String(huidigGetal).length;

      const startKolom = digitCol - breedte + 1;

      const gezaktVolgende = nextDigitChar(i + 1);

      stappen.push({
        huidig: huidigGetal,
        product: product,
        rest: nieuweRest,
        q: q,
        startKolom: startKolom,
        breedte: breedte,
        laatsteCijfer: gezaktVolgende,
        decimalStap: digitCol === decimalDividendPos - 1
      });

      rest = nieuweRest;
    }
    else if(gestart){
      // quotiëntcijfer 0
      const gezaktVolgende = nextDigitChar(i + 1);

      stappen.push({
        huidig: rest,
        product: 0,
        rest: rest,
        q: 0,
        startKolom: digitCol,
        breedte: 1,
        laatsteCijfer: gezaktVolgende
      });
    }

    digitCol++;
  }

  if(decimalQuotPos === null){
    decimalQuotPos = stappen.length;
  }

  return { stappen, decimalQuotPos };
}

/* =========================================================
   HULPFUNCTIES (algemeen)
========================================================= */
function random(a,b){
  return Math.floor(Math.random()*(b-a+1))+a;
}

function maakLeegRooster(aantalRijen, aantalKolommen){
  return Array.from({length:aantalRijen}, () =>
    Array.from({length:aantalKolommen}, () =>
      ({waarde:"", type:""})
    )
  );
}

/* =========================================================
   ROOSTER OPVULLEN (werkzone)
========================================================= */
function vulRooster(state){
  const stappen = state.stappen;
  if(!stappen || stappen.length === 0){
    return [[{waarde:""}]];
  }

  const kolommen = Math.max(
    ...stappen.map((s, i) => s.startKolom + s.breedte + (i < stappen.length-1 ? 1 : 0)),
    1
  );

  // 2 rijen per stap: product-rij en aftrek-rij
  const rijen = stappen.length * 2;
  const rooster = maakLeegRooster(rijen, kolommen);

  stappen.forEach((stap, index) => {
    const productRij = index * 2;
    const aftrekRij  = productRij + 1;

    const productStr = String(stap.product).padStart(stap.breedte,"0");
    const aftrekStr  = String(stap.rest).padStart(stap.breedte,"0");

    // product
    for (let i = 0; i < stap.breedte; i++) {
      rooster[productRij][stap.startKolom + i] =
        { waarde: productStr[i], type: "product" };
    }

    // aftrek (rest)
    for (let i = 0; i < stap.breedte; i++) {
      rooster[aftrekRij][stap.startKolom + i] =
        { waarde: aftrekStr[i], type: "aftrek" };
    }

    // gezakt (indien niet laatste stap)
    if (index < stappen.length - 1) {
      const gezakt = stap.laatsteCijfer || "";
      const colNaBlok = stap.startKolom + stap.breedte;

      const bestaand = (rooster[aftrekRij][colNaBlok] || { waarde: "", type: "" });
      const nieuwType = (bestaand.type ? (bestaand.type + " ") : "") + "gezakt";

      rooster[aftrekRij][colNaBlok] = {
        waarde: gezakt,
        type: nieuwType
      };
    }
  });

  // === NADERHAND: verticale groene lijn toevoegen, alleen bij Gemiddeld ===
  if (state.level === "3") {
    const idxDecimalStap = state.stappen.findIndex(s => s.decimalStap);
    if (idxDecimalStap !== -1) {
      const stap = state.stappen[idxDecimalStap];
      const col = stap.startKolom + stap.breedte;
      const aftrekRij = idxDecimalStap * 2 + 1;

      for (let r = aftrekRij; r < rooster.length; r++) {
        const bestaand = (rooster[r][col] || { waarde: "", type: "" });
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

    document.getElementById("btnNew")
      .addEventListener("click", startNieuweOefening);

    // leerling typt ',' of '.' om de komma te plaatsen
    document.addEventListener("keydown", (e) => {
      if (e.key === "," || e.key === ".") {
        // Alleen reageren wanneer er een komma hoort te zijn
        if (!state.showCommaPlaceholder) return;

        if (state.selectedIndex == null) {
          state.selectedIndex = state.decimalQuotPos;
        }
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

  tekenOefening(state){
    this.tekenDividend(state.dividend);
    this.tekenDivisor(state.divisor);
    this.tekenQuotient(state.stappen);
    this.tekenworkArea(state);
  },

  tekenDividend(getal){
    if(!this.dividendNode) return;
    this.dividendNode.innerHTML = "";

    const s = toUI(getal); // b.v. "123,45"
    const chars = s.split("");
    const cijfers = chars.filter(c => c >= '0' && c <= '9'); // tel enkel cijfers

    this.dividendNode.style.display = "grid";
    this.dividendNode.style.gridTemplateColumns = `repeat(${cijfers.length},40px)`;

    let laatsteCel = null;
    chars.forEach(ch => {
      if(ch === SEP_UI){ // komma tekenen aan de rechterkant van de vorige cel
        if(laatsteCel){
          const punt = document.createElement("span");
          punt.textContent = SEP_UI;
          punt.style.position = "absolute";
          punt.style.right = "-6px";
          punt.style.bottom = "-4px";
          punt.style.fontWeight = "bold";
          laatsteCel.appendChild(punt);
        }
        return;
      }
      const cel = document.createElement("div");
      cel.className = "gridcell";
      cel.textContent = ch;
      this.dividendNode.appendChild(cel);
      laatsteCel = cel;
    });
  },

  tekenDivisor(getal){
    if(!this.divisorNode) return;
    this.divisorNode.innerHTML = "";

    const s = toUI(getal);
    const chars = s.split("");

    const enkelCijfers = chars.filter(c => c >= '0' && c <= '9');

    this.divisorNode.style.display = "grid";
    this.divisorNode.style.gridTemplateColumns = `repeat(${enkelCijfers.length},40px)`;

    let laatsteCel = null;
    chars.forEach(ch => {
      if(ch === SEP_UI){
        if(laatsteCel){
          const punt = document.createElement("span");
          punt.textContent = SEP_UI;
          punt.style.position = "absolute";
          punt.style.right = "-6px";
          punt.style.bottom = "-4px";
          punt.style.fontWeight = "bold";
          laatsteCel.appendChild(punt);
        }
        return;
      }
      const cel = document.createElement("div");
      cel.className = "gridcell";
      cel.textContent = ch;
      this.divisorNode.appendChild(cel);
      laatsteCel = cel;
    });
  },

  tekenQuotient(stappen){
    this.quotientNode.innerHTML = "";

    const digitsCount = stappen.length;

    // Alleen komma tonen wanneer het zinvol is (Gemiddeld/Moeilijk/Zeer moeilijk)
    const shouldShowComma = state.showCommaPlaceholder === true;

    // Bepaal de komma-positie:
    // - als leerling al geplaatst -> userDecimalPos
    // - anders de verwachte plek -> decimalQuotPos
    // - maar alleen als shouldShowComma true is
    const commaPos = shouldShowComma
      ? (state.userDecimalPos != null ? state.userDecimalPos : state.decimalQuotPos)
      : null;

    // Kolommen: cijfers + (1 als we een komma tonen)
    const totalCols = digitsCount + (shouldShowComma ? 1 : 0);

    this.quotientNode.style.display = "grid";
    this.quotientNode.style.gridTemplateColumns = `repeat(${totalCols},40px)`;

    let digitPtr = 0;

    for (let pos = 0; pos <= digitsCount; pos++) {

      // 1) Komma-cel (alleen als we ze moeten tonen en dit de juiste plek is)
      if (shouldShowComma && pos === commaPos) {
        const celComma = document.createElement("div");
        celComma.className = "gridcell comma";
        celComma.textContent = ",";
        if (state.userDecimalPos == null) {
          celComma.classList.add("expected");   // placeholder-stijl
        } else {
          celComma.classList.add("userPlaced"); // door leerling gezet
        }
        this.quotientNode.appendChild(celComma);
      }

      // 2) Cijfercellen
      if (digitPtr < digitsCount) {
        const celDigit = document.createElement("div");
        celDigit.className = "gridcell";

        const digit = stappen[digitPtr]?.q ?? "";
        celDigit.textContent = digit;

        // Klik = invoerpositie voor de komma (vóór dit cijfer)
        celDigit.addEventListener("click", () => {
          state.selectedIndex = pos;
          this.tekenQuotient(state.stappen);
        });

        // Visuele hint op gekozen positie
        if (state.selectedIndex === pos) {
          celDigit.classList.add("sel");
        }

        this.quotientNode.appendChild(celDigit);
        digitPtr++;
      }
    }
  },

  tekenworkArea(state){
    if(!this.workAreaNode) return;
    this.workAreaNode.innerHTML = "";

    const rooster = vulRooster(state);
    if(!rooster || rooster.length === 0) return;

    const rows = rooster.length;
    const cols = Math.max(...rooster.map(r => r.length));

    this.workAreaNode.style.display = "grid";
    this.workAreaNode.style.gridTemplateColumns = `repeat(${cols},40px)`;
    this.workAreaNode.style.gridTemplateRows = `repeat(${rows},40px)`;

    // Onthoud kolommen voor index-berekening
    this._cols = cols;

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const celData = (rooster[r] && rooster[r][c]) ? rooster[r][c] : {waarde:"", type:""};
        const cel = document.createElement("div");
        cel.className = "gridcell";
        if(celData.type){
          for (const cls of String(celData.type).split(" ")) {
            const t = cls.trim();
            if (t) cel.classList.add(t);
          }
        }
        cel.textContent = (celData.type === "lijn") ? "" : (celData.waarde || "");
        this.workAreaNode.appendChild(cel);
      }
    }
  }
};

/* =========================================================
   Antwoordvelden (bovenaan)
========================================================= */
function resetAnswerInputs(){
  const q = document.getElementById("inputQuotient");
  const r = document.getElementById("inputRest");
  if (q) q.value = "";
  if (r) r.value = "";
}

function fillCorrectAnswers(){
  const q = document.getElementById("inputQuotient");
  const r = document.getElementById("inputRest");
  if (!q || !r) return;

  // Niveau-afhankelijk:
  if (state.level === "1" || state.level === "2") {
    // Integere deling met rest
    const qInt = Math.floor(state.dividend / state.divisor);
    const rInt = state.dividend - qInt * state.divisor;
    q.value = String(qInt);         // integer quotiënt
    r.value = String(rInt);         // exacte rest
  } else {
    // Decimalen, komt uit (rest = 0)
    const decs = (state.level === "3") ? 2 : 3; // Gemiddeld=2, Moeilijk/Zeer moeilijk=3
    const qDec = (state.dividend / state.divisor).toFixed(decs);
    q.value = toUI(qDec);           // met komma
    r.value = "0";
  }
}

/* =========================================================
   START NIEUWE OEFENING
========================================================= */
function startNieuweOefening(){
  const diff = document.getElementById("difficulty").value;
  state.level = diff; // niveau onthouden
  state.decimalReminderShown = false; // (niet actief, gereserveerd)

  const oef = genereerOefening(diff);

  // LET OP: 'let' gebruiken zodat we kunnen aanpassen bij zeer moeilijk (5)
  let deeltal = oef.dividend;
  let deler   = oef.divisor;

  // Onthoud de originelen voor de opgave-weergave (bovenaan)
  state.originalDividend = deeltal;
  state.originalDivisor  = deler;

  // === Alleen voor ZEER MOEILIJK (5): deler met komma -> schaal beide zodat deler geheel wordt
  if (diff === "5") {
    const k = decimalPlaces(deler); // aantal decimalen in de deler
    if (k > 0) {
      const keepDecimals = Math.max(0, CONFIG.maxDecimalen - k);
      const scaledDividend = scaleNumber(deeltal, k, keepDecimals);
      const scaledDivisor  = Math.round(parseFloat(toInternal(deler)) * (10 ** k));
      deeltal = scaledDividend;
      deler   = scaledDivisor;
    }
  }

  // Vanaf hier rekent/tekent de UI met (eventueel) geschaalde waarden
  state.dividend = deeltal;
  state.divisor  = deler;

  const res = berekenDelen(deeltal, deler);
  state.stappen = res.stappen;

  // quotiënt-positie (leerling kan nog steeds zelf plaatsen)
  state.decimalQuotPos = res.decimalQuotPos;
  state.userDecimalPos = null;                 // nog niet zichtbaar
  state.selectedIndex  = state.decimalQuotPos; // standaard typ-positie = juiste plek

  // Alleen komma tonen als (na schalen) deeltal of deler decimalen hebben
  const hasDecimalDividend = toInternal(deeltal).includes(".");
  const hasDecimalDivisor  = toInternal(deler).includes(".");
  state.showCommaPlaceholder = hasDecimalDividend || hasDecimalDivisor;

  state.decimalDividendPos = toInternal(deeltal).indexOf(".");

  // === Opgave bovenaan: 
  // - Bij ZEER MOEILIJK (5) tonen we de ORIGINELE opgave (dus met komma in de deler).
  // - Bij andere niveaus tonen we gewoon de huidige (deeltal : deler).
  const opgaveText = (diff === "5")
    ? `${toUI(state.originalDividend)} : ${toUI(state.originalDivisor)} =`
    : `${toUI(deeltal)} : ${toUI(deler)} =`;

  document.getElementById("opgaveTekst").textContent = opgaveText;

  // Antwoordvelden resetten + juiste antwoorden invullen
  resetAnswerInputs();
  fillCorrectAnswers();

  UI.tekenOefening(state);
}

/* =========================================================
   BOOTSTRAP
========================================================= */
window.addEventListener("DOMContentLoaded", () => {
  UI.init();
  startNieuweOefening();
});
