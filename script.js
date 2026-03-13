<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Staartdeling Oefening</title>
<style>
  body{font-family:sans-serif;}
  .grid{display:grid; gap:2px; margin-bottom:10px;}
  .gridcell{border:1px solid #ccc; width:40px; height:40px; text-align:center; line-height:40px;}
  .stepRow{margin-bottom:5px;}
  .stepInput{width:50px; margin-right:5px;}
  .mini{font-size:12px; color:#666;}
</style>
</head>
<body>

<h2>Staartdeling Oefening</h2>
<label>Niveau:
  <select id="levelSelect">
    <option value="1">1 (eenvoudig)</option>
    <option value="2">2 (gemiddeld)</option>
    <option value="3">3 (iets moeilijker)</option>
    <option value="4">4 (moeilijk)</option>
    <option value="5">5 (zeer moeilijk)</option>
  </select>
</label>
<button id="btnNew">Nieuwe Oefening</button>

<h3>Dividend:</h3>
<div id="grid" class="grid"></div>

<h3>Divisor:</h3>
<div id="divGrid" class="grid"></div>

<h3>Quotient:</h3>
<div id="quotientRow" class="grid"></div>

<h3>Stappen invullen:</h3>
<div id="stepInputs"></div>

<script>
"use strict";

// ==================== HELPERS ====================
const SEP_UI = ',';
function toInternal(val){ return String(val).replace(',', '.'); }
function toUI(val){ return String(val).replace('.', SEP_UI); }
function parseLearnerNumber(s){ const n=parseFloat(toInternal(s)); return Number.isFinite(n)?n:null; }
function divMetVasteDecimalen(dividend,divisor,dec=2){ const pow=10**dec; const q=Math.floor((dividend/divisor)*pow)/pow; const r=Number((dividend-q*divisor).toFixed(dec)); return {q,r}; }
function random(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function decimalPlaces(val){ const i=toInternal(val).indexOf('.'); return i===-1?0:(toInternal(val).length-i-1); }
function rondAf(getal,dec){ return Number(getal.toFixed(dec)); }

// ==================== STATE ====================
const state={
  dividend:0, divisor:0, stappen:[], userSteps:[], userGrid:[], stepMode:false,
  showCommaPlaceholder:false, decimalQuotPos:null, userDecimalPos:null, revealQuotient:false,
  selectedIndex:null, level:"1", originalDividend:null, originalDivisor:null
};

// ==================== OEFENING GENERATORS ====================
function genereerBasis(){ const d=random(2,9), q=random(2,99), D=d*q; if(D<10||D>999) return genereerBasis(); return {dividend:D,divisor:d}; }
function genereerMakkelijk(){ return {dividend:random(10,999), divisor:random(2,9)}; }
function genereerGemiddeld(){ for(let i=0;i<1000;i++){ const d=random(2,12); const dec=random(1,2); const pow=10**dec; const intPart=random(100,9999); const frac=random(0,pow-1); const D=(intPart*pow+frac)/pow; if((intPart*pow+frac)%d!==0) return {dividend:D,divisor:d}; } return genereerGemiddeld(); }
function genereerMoeilijk(){ for(let i=0;i<2000;i++){ const d=random(2,20); const pow=1000; const intPart=random(1000,99999); const frac=random(0,pow-1); const D=(intPart*pow+frac)/pow; if((intPart*pow+frac)%d!==0) return {dividend:D,divisor:d}; } return genereerMoeilijk(); }
function genereerZeerMoeilijk(){ for(let i=0;i<2000;i++){ const dec=random(1,2); const d=Number(randomDecimal(2,10,dec).toFixed(dec)); const qInt=random(10000,400000), q=qInt/1000; const rInt=random(1,Math.floor(d*1000)-1), r=rInt/1000; let D=Number((q*d+r).toFixed(3)); if(String(Math.floor(D)).length>=3&&String(Math.floor(D)).length<=5) return {dividend:D,divisor:d}; } const d=Number(randomDecimal(2,10,2).toFixed(2)), q=randomDecimal(1,200,3), r=randomDecimal(0.001,d-0.001,3); return {dividend:Number((q*d+r).toFixed(3)),divisor:d}; }
function genereerOefening(lvl){ switch(lvl){case"1":return genereerBasis();case"2":return genereerMakkelijk();case"3":return genereerGemiddeld();case"4":return genereerMoeilijk();case"5":return genereerZeerMoeilijk();} return genereerBasis(); }

// ==================== STAARTDELING ====================
function berekenDelen(D,d){ 
  const chars=toInternal(D).split(''); let stappen=[], decPos=chars.indexOf('.'); let rest=0, gestart=false, digitCol=0, decimalQuotPos=null; 
  function isDigit(c){return c>='0'&&c<='9';}
  function nextDigitChar(i){for(let j=i;j<chars.length;j++) if(isDigit(chars[j])) return chars[j]; return "";}
  for(let i=0;i<chars.length;i++){ const ch=chars[i]; if(ch==='.') { if(decimalQuotPos===null) decimalQuotPos=stappen.length; continue;} if(!isDigit(ch)) continue; const cijfer=Number(ch); rest=rest*10+cijfer; if(rest>=d){gestart=true; const q=Math.floor(rest/d); const product=q*d; const nieuweRest=rest-product; const breedte=Math.max(String(rest).length,String(product).length); const startKolom=digitCol-breedte+1; const gezakt=nextDigitChar(i+1); stappen.push({huidig:rest,product,rest:nieuweRest,q,startKolom,breedte,laatsteCijfer:gezakt,decimalStap:digitCol===decPos-1}); rest=nieuweRest;} else if(gestart){ const gezakt=nextDigitChar(i+1); const breedte=String(rest).length; stappen.push({huidig:rest,product:0,rest:rest,q:0,startKolom:digitCol-breedte+1,breedte,laatsteCijfer:gezakt,decimalStap:false}); } digitCol++; }
  if(decimalQuotPos===null) decimalQuotPos=stappen.length;
  return {stappen,decimalQuotPos};
}

// ==================== UI ====================
const UI={
  cacheDOM(){this.dividendNode=document.getElementById("grid");this.divisorNode=document.getElementById("divGrid");this.quotientNode=document.getElementById("quotientRow");this.workAreaNode=document.getElementById("workArea");},
  init(){ this.cacheDOM(); document.getElementById("btnNew")?.addEventListener("click",startNieuweOefening); },
  tekenOefening(){ this.tekenDividend(state.dividend); this.tekenDivisor(state.divisor); },
  tekenDividend(D){ const node=this.dividendNode; if(!node) return; node.innerHTML=""; const s=toUI(D), cijfers=s.split("").filter(c=>c>='0'&&c<='9'); node.style.display="grid"; node.style.gridTemplateColumns=`repeat(${cijfers.length},40px)`; s.split("").forEach(ch=>{ if(ch!==SEP_UI){ const cel=document.createElement("div"); cel.className="gridcell"; cel.textContent=ch; node.appendChild(cel); } }); },
  tekenDivisor(d){ const node=this.divisorNode; if(!node) return; node.innerHTML=""; const s=toUI(d), cijfers=s.split("").filter(c=>c>='0'&&c<='9'); node.style.display="grid"; node.style.gridTemplateColumns=`repeat(${cijfers.length},40px)`; s.split("").forEach(ch=>{ if(ch!==SEP_UI){ const cel=document.createElement("div"); cel.className="gridcell"; cel.textContent=ch; node.appendChild(cel); } }); }
};

// ==================== START NIEUWE OEFENING ====================
function startNieuweOefening(){
  const oef=genereerOefening(state.level); 
  state.dividend=oef.dividend; 
  state.divisor=oef.divisor;
  state.originalDividend=oef.dividend;
  state.originalDivisor=oef.divisor;
  const res=berekenDelen(state.dividend,state.divisor);
  state.stappen=res.stappen; state.decimalQuotPos=res.decimalQuotPos;
  UI.tekenOefening();
}

// ==================== AUTOMATISCH STARTEN ====================
document.addEventListener("DOMContentLoaded",()=>{
  UI.init();
  startNieuweOefening();
});
</script>

</body>
</html>
