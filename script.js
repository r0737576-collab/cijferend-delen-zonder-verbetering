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

    // Zorg dat er (op dec decimalen) een rest is:
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
  const deler = random(2, 20);
  const quotient = randomDecimal(1, 500, 3);
  const dividend = rondAf(deler * quotient, 3);
  const len = String(Math.floor(dividend)).length;
  if (len < 4 || len > 5) return genereerMoeilijk();
  return { dividend, divisor: deler };
}

function genereerZeerMoeilijk() {
  const deler = randomDecimal(2, 10, 2); // tussen 2 en 10
  const quotient = randomDecimal(1, 500, 3);
  const dividend = rondAf(deler * quotient, 3);
  const len = String(Math.floor(dividend)).length;
  if (len < 3 || len > 5) return genereerZeerMoeilijk();
  return { dividend, divisor: deler };
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

      const breedte = String(rest).length;
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
      stappen.push({
        huidig: rest,
        product: 0,
        rest: rest,
        q: 0,
        startKolom: digitCol,
        breedte: 1,
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

    document.getElementById("btnNew")
      .addEventListener("click", startNieuweOefening);

    document.addEventListener("keydown", (e)=>{
      if(e.key === "," || e.key === "."){
        if(!state.showCommaPlaceholder) return;

        if(state.selectedIndex == null)
          state.selectedIndex = state.decimalQuotPos;

        state.userDecimalPos = state.selectedIndex;
        this.tekenQuotient(state.stappen);
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

  if(state.level === "1" || state.level === "2"){
    const qInt = Math.floor(state.dividend / state.divisor);
    const rInt = state.dividend - qInt * state.divisor;
    q.value = String(qInt);
    r.value = String(rInt);
    return;
  }

  if (state.level === "3"){
    // Aantal decimalen van het DEELTAL bepaalt alles (0, 1 of 2).
    const decQ = decimalPlaces(state.dividend);

    // Trunceren tot decQ decimalen (geen afronding), rest op hetzelfde niveau.
    const { q: qDec, r: rDec } = divMetVasteDecimalen(state.dividend, state.divisor, decQ);
    q.value = toUI(qDec.toFixed(decQ));

    // Rest ALTIJD tonen op decQ decimalen (ook als dat 0 is → een geheel getal)
    r.value = toUI(rDec.toFixed(decQ));
    return;
  }

  // Niveau 4 en 5: laat zoals je prefereert (hier: 3 decimalen afronden en rest=0)
  const dec = 3;
  const qDec = (state.dividend / state.divisor);
  q.value = toUI(qDec.toFixed(dec));
  r.value = "0";
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
  fillCorrectAnswers();

  UI.tekenOefening();
}

/* =========================================================
   BOOTSTRAP
========================================================= */
window.addEventListener("DOMContentLoaded",()=>{
  UI.init();
  startNieuweOefening();
});
