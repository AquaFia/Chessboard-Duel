
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const glyph={w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
const value={p:100,n:320,b:330,r:500,q:900,k:0};
let catalog=[], chars={}, game=new Chess(), config={}, selected=null, running=false, timer=null, seedRng=Math.random, openingStates={w:null,b:null}, matchMemory={w:null,b:null};


const STOCKFISH_SOURCE="Stockfish 18 lite single-threaded (GPLv3)";
class StockfishService{
 constructor(){this.engine=null;this.readyPromise=null;this.active=null;this.failedReason="";}
 async ready(){
  if(this.engine)return true;
  if(this.readyPromise)return this.readyPromise;
  this.readyPromise=(async()=>{
   try{
    if(typeof globalThis.Stockfish!=="function")throw new Error("Stockfish loader did not load.");
    this.engine=await globalThis.Stockfish();
    this.engine.addMessageListener(line=>this.handle(String(line)));
    await this.waitFor("uciok",()=>this.engine.postMessage("uci"),8000);
    await this.waitFor("readyok",()=>this.engine.postMessage("isready"),8000);
    this.engine.postMessage("setoption name Hash value 32");
    return true;
   }catch(error){
    this.failedReason=error?.message||String(error);
    console.error("Stockfish failed to initialize.",error);
    this.engine=null;
    throw error;
   }
  })();
  return this.readyPromise;
 }
 waitFor(token,start,timeout){
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{if(this.active?.token===token)this.active=null;reject(new Error(`Stockfish timed out waiting for ${token}.`));},timeout);
   this.active={token,lines:[],resolve:()=>{clearTimeout(timer);this.active=null;resolve(true);}};
   start();
  });
 }
 handle(line){
  const active=this.active;if(!active)return;
  if(active.token==="bestmove"){
   if(line.startsWith("info "))active.lines.push(line);
   if(line.startsWith("bestmove ")){const resolve=active.resolve,lines=active.lines;clearTimeout(active.timer);this.active=null;resolve(lines);}
   return;
  }
  if(line.includes(active.token))active.resolve();
 }
 async analyze(fen,uciMoves,{multiPV=5,movetime=250}={}){
  await this.ready();
  if(!this.engine)throw new Error(this.failedReason||"Stockfish is unavailable.");
  if(!uciMoves.length)throw new Error("Stockfish analysis requires at least one candidate move.");
  if(this.active)throw new Error("Stockfish analysis requested while the engine is busy.");
  const count=Math.max(1,Math.min(multiPV,uciMoves.length));
  this.engine.postMessage("stop");
  this.engine.postMessage(`setoption name MultiPV value ${count}`);
  this.engine.postMessage(`position fen ${fen}`);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.engine?.postMessage("stop");if(this.active?.token==="bestmove")this.active=null;reject(new Error("Stockfish analysis timed out."));},Math.max(5000,movetime+4000));
   this.active={token:"bestmove",lines:[],timer,resolve:(lines)=>{clearTimeout(timer);resolve(parseStockfishLines(lines));}};
   this.engine.postMessage(`go movetime ${Math.round(movetime)} searchmoves ${uciMoves.join(" ")}`);
  });
 }
}
function parseStockfishLines(lines){
 const latest=new Map();
 for(const line of lines){
  const pv=line.match(/\bmultipv\s+(\d+).*?\bscore\s+(cp|mate)\s+(-?\d+).*?\bpv\s+(\S+)/);
  if(!pv)continue;
  const rank=Number(pv[1]),kind=pv[2],raw=Number(pv[3]),uci=pv[4];
  const score=kind==="mate"?(raw>0?100000-1000*Math.abs(raw):-100000+1000*Math.abs(raw)):raw;
  latest.set(rank,{rank,uci,objectiveScore:score,scoreType:kind,rawScore:raw});
 }
 return [...latest.values()].sort((a,b)=>a.rank-b.rank);
}
function moveToUci(move){return `${move.from}${move.to}${move.promotion||""}`;}
const stockfish=new StockfishService();

async function loadCharacters(){
 const response=await fetch("characters/characters.json",{cache:"no-store"});
 if(!response.ok)throw new Error(`Could not load character roster (${response.status})`);

 const roster=await response.json();
 const files=Array.isArray(roster.characters)?roster.characters:[];

 const loaded=await Promise.all(files.map(async file=>{
  const characterResponse=await fetch(`characters/${file}`,{cache:"no-store"});
  if(!characterResponse.ok)throw new Error(`Could not load character file: ${file}`);
  const character=await characterResponse.json();
  validateCharacter(character,file);
  return character;
 }));

 catalog=loaded;
 chars=Object.fromEntries(loaded.map(character=>[character.id,character]));

 for(const sel of ["#whiteCharacter","#blackCharacter"]){
  const el=$(sel);
  el.innerHTML=loaded.map(character=>
   `<option value="${character.id}">${character.name}</option>`
  ).join("");
 }

 if(!loaded.length)throw new Error("The character roster is empty.");

 $("#whiteCharacter").value=chars.jace?"jace":loaded[0].id;
 $("#blackCharacter").value=chars.juno?"juno":loaded[Math.min(1,loaded.length-1)].id;
}

function validateCharacter(character,file){
 const required=["corePersonality","chessAptitude","currentChessSkill","behaviorModel","decisionModel"];
 if(!character.id)throw new Error(`${file} is missing id.`);
 if(!character.dialogue)throw new Error(`${character.id} is missing dialogue.`);
 if(!character.personalityProfile)throw new Error(`${character.id} is missing personalityProfile.`);
 if(!Number.isFinite(character.personalityProfile.estimatedElo))throw new Error(`${character.id} personalityProfile is missing numeric estimatedElo.`);
 for(const section of required){
  if(character.personalityProfile[section]==null){
   throw new Error(`${character.id} personalityProfile is missing ${section}.`);
  }
 }
 if(character.relationships){
  for(const [opponentId,events] of Object.entries(character.relationships)){
   if(!events||typeof events!=="object"||Array.isArray(events)){
    throw new Error(`${character.id} relationship with ${opponentId} must be an event object.`);
   }
   for(const [event,lines] of Object.entries(events)){
    if(!Array.isArray(lines)||!lines.length||lines.some(line=>typeof line!=="string"||!line.trim())){
     throw new Error(`${character.id} relationship ${opponentId}.${event} must contain dialogue lines.`);
    }
   }
  }
 }
 if(character.openingProfile){
  for(const color of ["white","black"]){
   const profile=character.openingProfile[color];
   if(!profile)continue;
   if(typeof profile!=="object"||Array.isArray(profile)){
    throw new Error(`${character.id} openingProfile.${color} must be an object.`);
   }
   if(profile.freeformWeight!=null&&(!Number.isFinite(profile.freeformWeight)||profile.freeformWeight<0)){
    throw new Error(`${character.id} openingProfile.${color}.freeformWeight must be a non-negative number.`);
   }
   if(!Array.isArray(profile.lines)){
    throw new Error(`${character.id} openingProfile.${color}.lines must be an array.`);
   }
   for(const [index,line] of profile.lines.entries()){
    if(!line||typeof line!=="object"||Array.isArray(line)){
     throw new Error(`${character.id} openingProfile.${color}.lines[${index}] must be an object.`);
    }
    if(typeof line.name!=="string"||!line.name.trim()){
     throw new Error(`${character.id} opening line ${color}[${index}] is missing a name.`);
    }
    if(!Number.isFinite(line.weight)||line.weight<0){
     throw new Error(`${character.id} opening line ${line.name} must have a non-negative weight.`);
    }
    if(!Array.isArray(line.moves)||!line.moves.length||line.moves.some(move=>typeof move!=="string"||!move.trim())){
     throw new Error(`${character.id} opening line ${line.name} must contain SAN moves.`);
    }
   }
  }
 }
}

function seeded(seed){
 let h=2166136261;
 for(const ch of seed)h=Math.imul(h^ch.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
}
function fallbackSvg(c,expression){
 const p=c.fallbackPortrait||{};
 const happy=["happy","excited","satisfied","knowing"].includes(expression);
 const worried=["worried","annoyed"].includes(expression);
 const smug=["smug","knowing","satisfied"].includes(expression);
 const surprised=expression==="surprised";
 const mouth=happy?"M82 116 Q100 130 118 116":worried?"M84 124 Q100 111 116 124":smug?"M88 119 Q103 125 117 115":"M91 119 Q100 123 109 119";
 const eye=surprised?9:6;
 return `<svg viewBox="0 0 200 260" role="img" aria-label="${c.name}">
 <defs><linearGradient id="h" x2="0" y2="1"><stop stop-color="${p.hairTop||c.theme.primary}"/><stop offset="1" stop-color="${p.hairBottom||c.theme.secondary}"/></linearGradient></defs>
 <ellipse cx="100" cy="117" rx="74" ry="91" fill="url(#h)"/><path d="M38 246 Q44 166 100 160 Q157 166 164 246" fill="${p.shirt||c.theme.panel}"/>
 <ellipse cx="100" cy="102" rx="51" ry="62" fill="${p.skin||'#efd2d4'}"/><path d="M48 84 Q57 25 104 28 Q150 29 153 90 Q126 66 112 41 Q91 70 48 84" fill="url(#h)"/>
 <ellipse cx="78" cy="101" rx="${eye}" ry="${eye+3}" fill="${p.eyes||'#623aaa'}"/><ellipse cx="122" cy="101" rx="${eye}" ry="${eye+3}" fill="${p.eyes||'#623aaa'}"/>
 <circle cx="76" cy="98" r="2" fill="white"/><circle cx="120" cy="98" r="2" fill="white"/><path d="${mouth}" fill="none" stroke="#783849" stroke-width="3" stroke-linecap="round"/>
 ${p.accessory==="constellation"?'<path d="M145 60 L165 48 L171 72 L151 83 Z" fill="none" stroke="#ddd" stroke-width="2"/><circle cx="145" cy="60" r="3" fill="#eee"/><circle cx="165" cy="48" r="3" fill="#eee"/><circle cx="171" cy="72" r="3" fill="#eee"/><circle cx="151" cy="83" r="3" fill="#eee"/>':''}
 ${p.accessory==="sparkle"?'<path d="M157 55 l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#ffd477"/>':''}
 </svg>`;
}
function setCharacter(side,c,expression="neutral"){
 const box=$(`#${side}Card`);box.style.setProperty("--accent",c.theme.primary);box.style.setProperty("--accent2",c.theme.secondary);
 $(`#${side}Name`).textContent=c.name;$(`#${side}Talent`).textContent=c.talent;$(`#${side}Expression`).textContent=expression;
 const area=$(`#${side}Portrait`), path=c.portraits?.[expression];
 area.innerHTML=path?`<img src="${path}" alt="${c.name} — ${expression}">`:fallbackSvg(c,expression);
}
function createBoard(){
 const b=$("#board");b.innerHTML="";
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const sq=document.createElement("div"),alg=String.fromCharCode(97+c)+(8-r);
  sq.className="sq "+((r+c)%2?"dark":"light");sq.dataset.square=alg;
  if(c===0)sq.insertAdjacentHTML("beforeend",`<span class="coord rank">${8-r}</span>`);
  if(r===7)sq.insertAdjacentHTML("beforeend",`<span class="coord file">${String.fromCharCode(97+c)}</span>`);
  sq.onclick=()=>humanClick(alg);b.appendChild(sq);
 }
 renderBoard();
}
function renderBoard(last=[]){
 $$(".sq").forEach(x=>{x.classList.remove("selected","legal","last");[...x.querySelectorAll(".piece")].forEach(p=>p.remove())});
 for(const row of game.board())for(const p of row)if(p){
  const alg=String.fromCharCode(97+p.square.charCodeAt(0)-97)+p.square[1];
  const el=document.createElement("span");el.className=`piece ${p.color}`;el.textContent=glyph[p.color][p.type];
  document.querySelector(`[data-square="${alg}"]`).appendChild(el);
 }
 last.forEach(x=>document.querySelector(`[data-square="${x}"]`)?.classList.add("last"));
 if(selected){document.querySelector(`[data-square="${selected}"]`)?.classList.add("selected");game.moves({square:selected,verbose:true}).forEach(m=>document.querySelector(`[data-square="${m.to}"]`)?.classList.add("legal"))}
 updateStatus();
}
function sideMode(color){return color==="w"?config.whiteMode:config.blackMode}
function humanClick(sq){
 if(running||game.isGameOver()||sideMode(game.turn())!=="human")return;

 const piece=game.get(sq);
 const turn=game.turn();

 // Select one of the current player's pieces.
 if(!selected){
  selected=piece&&piece.color===turn?sq:null;
  renderBoard();
  return;
 }

 // Clicking the selected piece again cancels the selection.
 if(sq===selected){
  selected=null;
  renderBoard();
  return;
 }

 // Clicking another friendly piece switches selection immediately.
 if(piece&&piece.color===turn){
  selected=sq;
  renderBoard();
  return;
 }

 // Otherwise, attempt the move. Illegal destinations keep the current
 // piece selected so the player can try another square or switch pieces.
 const move=game.move({from:selected,to:sq,promotion:"q"});
 if(move){
  selected=null;
  afterMove(move);
 }else{
  renderBoard();
 }
}
function materialBalance(){
 let score=0;
 for(const row of game.board())for(const piece of row)if(piece)score+=(piece.color==="w"?1:-1)*value[piece.type];
 return score;
}
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const pct=n=>clamp01((Number(n)||0)/100);
function profileValue(section,key,fallback=50){
 const raw=Number(section?.[key]);
 return Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):fallback;
}
function generateBrain(c){
 const profile=c.personalityProfile;
 const core=profile.corePersonality;
 const aptitude=profile.chessAptitude;
 const skill=profile.currentChessSkill;
 const behavior=profile.behaviorModel;
 const decision=profile.decisionModel;
 const n=(section,key,fallback=50)=>pct(profileValue(section,key,fallback));
 const estimatedElo=Math.max(400,Math.min(2800,Number(profile.estimatedElo)||1200));

 // Perception and calculation. Every input has a distinct responsibility.
 const candidateAwareness=n(skill,"candidateAwareness");
 const threatDetection=n(skill,"threatDetection");
 const tacticalSkill=n(skill,"tacticalVision");
 const calculationSkill=n(skill,"calculation");
 const evaluationSkill=n(skill,"evaluationAccuracy");
 const skillPatterns=n(skill,"patternRecognition");
 const planningSkill=n(skill,"planning");
 const practicalAccuracy=n(skill,"practicalAccuracy");
 const timeManagement=n(skill,"timeManagement");

 const aptitudePatterns=n(aptitude,"patternRecognition");
 const tacticalPotential=n(aptitude,"tacticalVision");
 const strategicPotential=n(aptitude,"strategicPlanning");
 const calculationPotential=n(aptitude,"calculationPotential");
 const memory=n(aptitude,"memory");
 const spatial=n(aptitude,"spatialReasoning");
 const longTerm=n(aptitude,"longTermPlanning");
 const intuition=n(aptitude,"intuition");
 const learningSpeed=n(aptitude,"learningSpeed");
 const focus=n(aptitude,"focus");
 const composure=n(aptitude,"composureUnderPressure");
 const gameAdaptation=n(aptitude,"adaptationDuringGames");

 const patience=n(core,"patience");
 const creativity=n(core,"creativity");
 const curiosity=n(core,"curiosity");
 const confidenceTrait=n(core,"confidence");
 const emotionalStability=n(core,"emotionalStability");
 const adaptabilityTrait=n(core,"adaptability");
 const persistence=n(core,"persistence");
 const discipline=n(core,"discipline");
 const bluffing=n(core,"bluffing");
 const empathy=n(core,"empathy");
 const competitiveness=n(core,"competitiveness");
 const caution=n(core,"caution");
 const independence=n(core,"independence");
 const leadership=n(core,"leadership");
 const impulsiveness=n(core,"impulsiveness");
 const humor=n(core,"humor");
 const aggressionTrait=n(core,"aggression");
 const riskTrait=n(core,"riskTolerance");

 const intuitionReliance=n(decision,"intuitionReliance");
 const calculationReliance=n(decision,"calculationReliance");
 const planCommitment=n(decision,"planCommitment");
 const planFlexibility=n(decision,"planFlexibility");
 const psychologicalPlay=n(decision,"psychologicalPlay");
 const moveSpeed=n(decision,"moveSpeed");
 const overthinking=n(decision,"overthinking");

 const vision=clamp01(candidateAwareness*.42+skillPatterns*.18+aptitudePatterns*.14+spatial*.12+focus*.1+curiosity*.04);
 const calculation=clamp01(calculationSkill*.45+calculationPotential*.2+calculationReliance*.14+focus*.1+timeManagement*.07-overthinking*.08+patience*.08);
 const evaluation=clamp01(evaluationSkill*.48+practicalAccuracy*.2+intuition*.1*intuitionReliance+skillPatterns*.09+discipline*.08+emotionalStability*.05);
 const planning=clamp01(planningSkill*.42+strategicPotential*.18+longTerm*.16+memory*.08+patience*.08+leadership*.04+planCommitment*.04);
 const conversion=clamp01(n(skill,"conversion")*.62+practicalAccuracy*.13+discipline*.1+persistence*.08+patience*.07);
 const defense=clamp01(threatDetection*.42+n(behavior,"defensivePreference")*.2+n(behavior,"pieceProtection")*.14+caution*.1+composure*.08+empathy*.06);
 const initiative=clamp01(n(behavior,"initiativePreference")*.42+competitiveness*.16+aggressionTrait*.14+leadership*.1+confidenceTrait*.08+psychologicalPlay*.1);
 const confidence=clamp01(confidenceTrait*.42+practicalAccuracy*.2+composure*.14+emotionalStability*.12+competitiveness*.07+leadership*.05);
 const adaptability=clamp01(adaptabilityTrait*.34+gameAdaptation*.28+learningSpeed*.16+planFlexibility*.14+independence*.08);
 const risk=clamp01(riskTrait*.48+n(behavior,"sacrificeWillingness")*.18+impulsiveness*.12+creativity*.08+confidence*.08-caution*.1);
 const phaseKnowledge={
  opening:n(skill,"openingKnowledge"),
  middlegame:n(skill,"middlegameKnowledge"),
  endgame:n(skill,"endgameKnowledge")
 };
 const knowledgeAverage=(phaseKnowledge.opening+phaseKnowledge.middlegame+phaseKnowledge.endgame)/3;
 const analysisBudget=Math.round(90+(estimatedElo-400)/2400*760+calculation*180+timeManagement*100-focus*.0-overthinking*70);
 const stockfishMultiPV=Math.max(2,Math.min(8,Math.round(2+(estimatedElo-400)/480+candidateAwareness*1.2)));
 const complexity=clamp01(n(behavior,"complicationPreference")*.38+creativity*.16+risk*.14+curiosity*.1+humor*.07+independence*.07+initiative*.08);
 const simplification=clamp01(n(behavior,"simplificationPreference")*.5+caution*.13+planning*.12+conversion*.1+patience*.08-risk*.12+discipline*.09);
 const novelty=clamp01(creativity*.3+curiosity*.22+adaptability*.14+independence*.12+humor*.1+intuitionReliance*.08+planFlexibility*.04);
 const tactics=clamp01(tacticalSkill*.38+tacticalPotential*.18+calculation*.16+vision*.12+aptitudePatterns*.08+spatial*.08);
 const positional=clamp01(planning*.34+strategicPotential*.2+longTerm*.16+evaluation*.12+skillPatterns*.08+patience*.06+memory*.04);

 return {
  vision,threatDetection,calculation,evaluation,planning,conversion,defense,initiative,confidence,adaptability,risk,
  phaseKnowledge,knowledgeAverage,estimatedElo,analysisBudget,stockfishMultiPV,moveSpeed,timeManagement,overthinking,planCommitment,planFlexibility,persistence,discipline,
  learningSpeed,composure,emotionalStability,practicalAccuracy,calculationReliance,intuitionReliance,
  evaluationNoise:6+(1-evaluation)*78+(1-vision)*24+(1-practicalAccuracy)*18+overthinking*12,
  aggression:clamp01(aggressionTrait*.46+competitiveness*.16+initiative*.22+n(behavior,"initiativePreference")*.1-empathy*.06),
  tactics,positional,
  material:clamp01(n(behavior,"materialGreed")*.56+n(behavior,"captureConfidence")*.12+discipline*.1+caution*.08-risk*.12+practicalAccuracy*.08),
  captureConfidence:n(behavior,"captureConfidence"),
  sacrifice:n(behavior,"sacrificeWillingness"),
  kingSafety:clamp01(defense*.48+caution*.18+n(behavior,"pieceProtection")*.16+composure*.08-risk*.12+emotionalStability*.06),
  pieceProtection:n(behavior,"pieceProtection"),
  development:n(behavior,"developmentPriority"),
  novelty,
  randomness:clamp01(.025+(1-evaluation)*.18+(1-calculation)*.12+impulsiveness*.13+humor*.08+independence*.05+planFlexibility*.05-overthinking*.04),
  blunderChance:clamp01(.002+(1-vision)*.055+(1-threatDetection)*.045+(1-calculation)*.04+(1-practicalAccuracy)*.035+(1-composure)*.02),
  complexity,
  queenPreference:n(behavior,"queenActivity"),
  simplification,
  pressure:clamp01(bluffing*.22+psychologicalPlay*.32+confidence*.14+initiative*.18+aggressionTrait*.09+empathy*.05),
  psychologicalPlay,
  memory,focus,spatial,learningSpeed,adaptationDuringGames:gameAdaptation,
  patience,impulsiveness,empathy,leadership,humor,independence,
  openingKnowledge:phaseKnowledge.opening,middlegameKnowledge:phaseKnowledge.middlegame,endgameKnowledge:phaseKnowledge.endgame
 };
}
function brainFor(c){
 return c._brain||(c._brain=generateBrain(c));
}
function freshMemory(){
 return {
  checksAgainst:0,
  recentChecksAgainst:0,
  capturesAgainst:0,
  materialSwing:0,
  opponentRepeatStreak:0,
  opponentRepeatedSquare:null,
  lastMovedTo:null,
  openingDeviation:false,
  openingDeviationAnnounced:false,
  failedTactics:0,
  failedPlanPending:false,
  retaliationReady:false,
  contextualEvent:null,
  currentIntent:null,
  planAge:0
 };
}
function memoryForColor(color){
 return matchMemory[color]||(matchMemory[color]=freshMemory());
}
function characterColor(character){
 return character===config.white?"w":"b";
}
function memoryScore(move,character,position){
 const color=characterColor(character);
 const memory=memoryForColor(color);
 const brain=brainFor(character);
 const core=character.personalityProfile.corePersonality;
 const discipline=pct(core.discipline);
 let score=0;

 if(memory.recentChecksAgainst){
  if(move.san.includes("O-O"))score+=24+55*brain.kingSafety;
  if(position.check)score+=memory.recentChecksAgainst*(10+28*brain.aggression);
  if(move.piece==="q"&&!move.captured)score-=memory.recentChecksAgainst*16*brain.kingSafety;
 }
 if(memory.materialSwing<0){
  if(move.captured)score+=Math.min(70,-memory.materialSwing*.08)*(0.35+brain.aggression);
  if(position.check)score+=18*brain.pressure;
 }
 if(memory.opponentRepeatedSquare&&move.to===memory.opponentRepeatedSquare){
  score+=25+55*brain.pressure;
 }
 if(memory.openingDeviation){
  const complexity=Math.min(1,(position.replyCount+position.forcingReplies*2)/38);
  score+=(complexity-.35)*45*brain.novelty;
 }
 if(memory.failedTactics){
  const forcing=Boolean(move.captured||position.check);
  score+=forcing
   ?-Math.min(50,memory.failedTactics*14)*discipline
   :Math.min(25,memory.failedTactics*7)*discipline;
 }
 return score;
}
function updateMatchMemory(move,beforeEval,afterEval){
 const actorColor=move.color;
 const opponentColor=actorColor==="w"?"b":"w";
 const actor=memoryForColor(actorColor);
 const opponent=memoryForColor(opponentColor);
 const actorDelta=(actorColor==="w"?afterEval-beforeEval:beforeEval-afterEval);

 actor.materialSwing+=actorDelta;
 opponent.materialSwing-=actorDelta;

 if(move.captured){
  opponent.capturesAgainst++;
  opponent.retaliationReady=true;
  actor.failedPlanPending=false;
 }
 if(game.inCheck()){
  opponent.checksAgainst++;
  opponent.recentChecksAgainst=Math.min(3,opponent.recentChecksAgainst+1);
  actor.failedPlanPending=!move.captured&&!game.isCheckmate();
 }else{
  actor.recentChecksAgainst=Math.max(0,actor.recentChecksAgainst-1);
 }

 if(actor.lastMovedTo&&move.from===actor.lastMovedTo){
  actor.opponentRepeatStreak++;
 }else{
  actor.opponentRepeatStreak=1;
 }
 actor.lastMovedTo=move.to;

 opponent.opponentRepeatStreak=actor.opponentRepeatStreak;
 opponent.opponentRepeatedSquare=actor.opponentRepeatStreak>=2?move.to:null;

 if(opponent.failedPlanPending&&!move.captured&&!game.inCheck()){
  opponent.failedTactics++;
  opponent.failedPlanPending=false;
  opponent.contextualEvent="failedPlan";
 }
 if(actor.retaliationReady&&move.captured){
  actor.contextualEvent="retaliation";
  actor.retaliationReady=false;
 }else if(actor.recentChecksAgainst>=2){
  actor.contextualEvent="underPressure";
 }else if(actor.openingDeviation&&!actor.openingDeviationAnnounced){
  actor.contextualEvent="openingDeviation";
  actor.openingDeviationAnnounced=true;
 }else if(actor.opponentRepeatStreak>=2){
  opponent.contextualEvent="opponentRepeating";
 }
}
function pieceCount(){
 let count=0;
 for(const row of game.board())for(const piece of row)if(piece)count++;
 return count;
}
function squareFile(square){return square.charCodeAt(0)-97;}
function squareRank(square){return Number(square[1])-1;}
function centerDistance(square){
 return Math.abs(squareFile(square)-3.5)+Math.abs(squareRank(square)-3.5);
}
function analyzePosition(color){
 const opponent=color==="w"?"b":"w";
 const historyLength=game.history().length;
 const pieces=game.board().flat().filter(Boolean);
 const own=pieces.filter(piece=>piece.color===color);
 const enemy=pieces.filter(piece=>piece.color===opponent);
 const ownMaterial=own.reduce((sum,piece)=>sum+(value[piece.type]||0),0);
 const enemyMaterial=enemy.reduce((sum,piece)=>sum+(value[piece.type]||0),0);
 const materialBalance=ownMaterial-enemyMaterial;
 const queens=pieces.filter(piece=>piece.type==="q").length;
 const phase=historyLength<16?"opening":queens===0||pieceCount()<=14?"endgame":"middlegame";
 const legalMoves=game.moves({verbose:true});
 const forcingMoves=legalMoves.filter(move=>move.captured||String(move.san).includes("+")||String(move.san).includes("#"));
 const centerOccupancy=pieces.filter(piece=>["d4","d5","e4","e5"].includes(piece.square));
 const centerState=centerOccupancy.length>=3?"closed":centerOccupancy.length<=1?"open":"contested";
 const ownKing=own.find(piece=>piece.type==="k");
 const enemyKing=enemy.find(piece=>piece.type==="k");
 const ownKingEdge=ownKing?Math.min(squareFile(ownKing.square),7-squareFile(ownKing.square)):0;
 const enemyKingEdge=enemyKing?Math.min(squareFile(enemyKing.square),7-squareFile(enemyKing.square)):0;
 const kingSafety=clamp01(.72-(game.inCheck()&&game.turn()===color?.5:0)+(ownKingEdge<=1?.16:0));
 const enemyKingExposure=clamp01(.28+(enemyKingEdge>=2?.22:0)+forcingMoves.length/24);
 const development=clamp01(1-Math.max(0,16-historyLength)/16);
 const mobility=legalMoves.length;
 const initiative=clamp01(.35+forcingMoves.length/10+(game.inCheck()&&game.turn()===opponent?.28:0));
 const tension=clamp01(forcingMoves.length/8+legalMoves.filter(move=>move.captured).length/12);
 const passedPawnPotential=legalMoves.some(move=>move.piece==="p"&&((color==="w"&&squareRank(move.to)>=5)||(color==="b"&&squareRank(move.to)<=2)));
 return {
  color,opponent,phase,materialBalance,centerState,kingSafety,enemyKingExposure,
  development,mobility,initiative,tension,forcingMoves:forcingMoves.length,
  inCheck:game.inCheck()&&game.turn()===color,
  winning:materialBalance>120,losing:materialBalance<-120,
  passedPawnPotential,
  candidateIntents:[]
 };
}
function selectIntent(character,analysis){
 const brain=brainFor(character);
 const memory=memoryForColor(characterColor(character));
 const candidates=[];
 const add=(id,score)=>candidates.push({id,score});
 const phaseKnowledge=brain.phaseKnowledge[analysis.phase]??brain.knowledgeAverage;
 if(analysis.inCheck)add("emergencyDefense",100+45*brain.defense+35*brain.composure);
 if(analysis.phase==="opening"&&analysis.development<.72)add("completeDevelopment",44+48*brain.positional+40*brain.development+24*phaseKnowledge);
 if(analysis.winning){
  add("technicalConversion",62+76*brain.conversion+24*brain.persistence);
  add("restrictCounterplay",54+54*brain.kingSafety+26*brain.pieceProtection);
  add("simplify",40+66*brain.simplification);
 }
 if(analysis.losing){
  add("counterattack",42+66*brain.aggression+40*brain.pressure+24*brain.persistence);
  add("createComplications",40+72*brain.complexity+20*brain.sacrifice);
  add("reduceDanger",50+58*brain.kingSafety+26*brain.defense);
 }
 if(analysis.enemyKingExposure>.5)add("kingsideAttack",40+70*brain.aggression+44*brain.tactics+20*brain.initiative);
 if(analysis.forcingMoves>=2)add("tacticalOpportunity",46+76*brain.tactics+24*brain.captureConfidence+18*brain.sacrifice);
 if(analysis.centerState==="closed"){
  add("improveWorstPiece",48+66*brain.positional+22*brain.patience);
  add("pawnBreak",34+44*brain.aggression+28*brain.novelty+24*brain.development);
 }
 if(analysis.centerState==="open")add("seizeInitiative",42+60*brain.pressure+38*brain.tactics+26*brain.initiative);
 if(analysis.kingSafety<.55)add("reduceDanger",62+68*brain.kingSafety+30*brain.threatDetection);
 if(analysis.passedPawnPotential)add("advancePassedPawn",44+62*brain.conversion+20*brain.persistence);
 add("improvePosition",42+60*brain.positional+20*phaseKnowledge);
 add("createComplications",24+62*brain.complexity+28*brain.novelty);
 candidates.sort((a,b)=>b.score-a.score);
 analysis.candidateIntents=candidates.slice(0,4);

 // Committed planners keep a viable plan; flexible/adaptive players switch sooner.
 if(memory.currentIntent&&!analysis.inCheck){
  const retained=candidates.find(item=>item.id===memory.currentIntent);
  const best=candidates[0];
  const retention=clamp01(brain.planCommitment*.48+brain.persistence*.24+brain.discipline*.12-brain.planFlexibility*.22-brain.adaptability*.16);
  const viable=retained&&retained.score>=best.score-(18+retention*34);
  if(viable&&memory.planAge<1+Math.round(retention*4)&&seedRng()<.35+retention*.55){
   memory.planAge++;
   return memory.currentIntent;
  }
 }
 const top=candidates.slice(0,Math.min(3,candidates.length));
 const best=top[0].score;
 const temperature=14+(1-brain.planning)*28+brain.randomness*22+brain.planFlexibility*10;
 const weights=top.map(item=>Math.exp((item.score-best)/temperature));
 let roll=seedRng()*weights.reduce((sum,item)=>sum+item,0);
 let chosen=top[0].id;
 for(let index=0;index<top.length;index++){
  roll-=weights[index];
  if(roll<=0){chosen=top[index].id;break;}
 }
 memory.planAge=memory.currentIntent===chosen?memory.planAge+1:0;
 memory.currentIntent=chosen;
 return chosen;
}
function buildPlan(intent,analysis){
 const plans={
  emergencyDefense:{priorities:["kingSafety","tradePieces","centralize"]},
  completeDevelopment:{priorities:["developPiece","castle","centralize"]},
  technicalConversion:{priorities:["tradePieces","advancePawn","centralize"]},
  restrictCounterplay:{priorities:["reduceForcingReplies","kingSafety","centralize"]},
  simplify:{priorities:["tradePieces","reduceForcingReplies","kingSafety"]},
  counterattack:{priorities:["check","capture","increaseForcingReplies"]},
  createComplications:{priorities:["increaseForcingReplies","check","capture"]},
  reduceDanger:{priorities:["kingSafety","tradePieces","reduceForcingReplies"]},
  kingsideAttack:{priorities:["check","increaseForcingReplies","capture"]},
  tacticalOpportunity:{priorities:["check","capture","increaseForcingReplies"]},
  improveWorstPiece:{priorities:["developPiece","centralize","kingSafety"]},
  pawnBreak:{priorities:["advancePawn","capture","increaseForcingReplies"]},
  seizeInitiative:{priorities:["check","developPiece","centralize"]},
  advancePassedPawn:{priorities:["advancePawn","tradePieces","centralize"]},
  improvePosition:{priorities:["centralize","developPiece","kingSafety"]}
 };
 return {intent,phase:analysis.phase,priorities:plans[intent]?.priorities||plans.improvePosition.priorities};
}
function moveHistoryRepeatCount(move){
 const verbose=game.history({verbose:true});
 let count=0;
 for(let index=verbose.length-1;index>=0&&index>=verbose.length-8;index--){
  const previous=verbose[index];
  if(previous.color!==move.color)continue;
  if(previous.piece===move.piece&&previous.to===move.from)count++;
 }
 return count;
}
function moveFeatures(move,analysis){
 const capturedValue=move.captured?(value[move.captured]||0):0;
 const movingValue=value[move.piece]||0;
 const san=String(move.san||"");
 return {
  isMate:san.includes("#"),
  isCheck:san.includes("+")||san.includes("#"),
  isCapture:Boolean(move.captured),
  capturedValue,
  movingValue,
  captureGain:capturedValue-movingValue,
  castles:san.includes("O-O"),
  develops:move.piece!=="p"&&analysis.phase==="opening",
  central:!["a","b","g","h"].includes(move.to[0])&&["3","4","5","6"].includes(move.to[1]),
  pawnAdvance:move.piece==="p",
  queenMove:move.piece==="q",
  repeatCount:moveHistoryRepeatCount(move),
  quiet:!move.captured&&!san.includes("+")&&!san.includes("#")
 };
}
function discoveryChance(move,features,brain,plan,analysis){
 if(analysis.inCheck)return 1;
 if(features.isMate)return 1;
 const knowledge=brain.phaseKnowledge[analysis.phase]??brain.knowledgeAverage;
 let chance=.06+brain.vision*.44+brain.calculation*.07+knowledge*.08+brain.focus*.05;
 if(features.isCheck)chance+=.18+.22*brain.tactics+.12*brain.aggression;
 if(features.isCapture)chance+=.12+.18*brain.tactics+.14*brain.captureConfidence+.08*brain.material;
 if(features.capturedValue>=500)chance+=.22;
 if(features.castles)chance+=.1*brain.kingSafety+.06*brain.development;
 if(features.develops)chance+=.08*brain.positional+.1*brain.development;
 if(features.central)chance+=.06*brain.positional;
 if(features.quiet)chance-=.1*(1-brain.vision);
 if(features.queenMove)chance+=.06*brain.queenPreference;
 if(plan.priorities.includes("check")&&features.isCheck)chance+=.12;
 if(plan.priorities.includes("capture")&&features.isCapture)chance+=.1;
 if(plan.priorities.includes("developPiece")&&features.develops)chance+=.1;
 if(plan.priorities.includes("kingSafety")&&features.castles)chance+=.12;
 if(plan.priorities.includes("advancePawn")&&features.pawnAdvance)chance+=.08;
 return clamp01(chance);
}
function candidateTarget(brain,legalCount,analysis){
 if(analysis.inCheck)return legalCount;
 const knowledge=brain.phaseKnowledge[analysis.phase]??brain.knowledgeAverage;
 const competence=brain.vision*.4+brain.calculation*.2+brain.planning*.12+brain.evaluation*.08+knowledge*.1+brain.focus*.1;
 const target=Math.round(3+competence*12+brain.novelty*2-brain.overthinking*1.5);
 return Math.max(3,Math.min(legalCount,target));
}
function discoverCandidates(character,moves,analysis,plan){
 const brain=brainFor(character);
 const annotated=moves.map(move=>({move,features:moveFeatures(move,analysis)}));
 if(analysis.inCheck)return {noticed:annotated,missed:[]};
 const noticed=[];
 const missed=[];
 for(const item of annotated){
  const chance=discoveryChance(item.move,item.features,brain,plan,analysis);
  item.discoveryChance=chance;
  (seedRng()<chance?noticed:missed).push(item);
 }
 const target=candidateTarget(brain,moves.length,analysis);
 const importance=item=>{
  const f=item.features;
  return (f.isMate?10000:0)+(f.isCheck?450:0)+f.capturedValue*1.2+(f.castles?120:0)+(f.develops?55:0)+(f.central?25:0)-f.repeatCount*45;
 };
 noticed.sort((a,b)=>importance(b)-importance(a));
 missed.sort((a,b)=>importance(b)-importance(a));
 while(noticed.length<Math.min(target,moves.length)&&missed.length)noticed.push(missed.shift());
 if(noticed.length>target){
  missed.push(...noticed.splice(target));
 }
 return {noticed,missed};
}
function candidatePosition(move){
 const actor=move.color;
 const before=materialBalance();
 game.move(move);
 const after=materialBalance();
 const replies=game.moves({verbose:true});
 const terminalDraw=game.isDraw();
 const terminalMate=game.isCheckmate();
 const analysis=analyzePosition(actor);
 const result={
  material:actor==="w"?after-before:before-after,
  check:game.inCheck(),mate:terminalMate,draw:terminalDraw,
  repetition:typeof game.isThreefoldRepetition==="function"&&game.isThreefoldRepetition(),
  stalemate:typeof game.isStalemate==="function"&&game.isStalemate(),
  replyCount:replies.length,
  forcingReplies:replies.filter(reply=>reply.captured||String(reply.san).includes("+")||String(reply.san).includes("#")).length,
  phase:analysis.phase,
  centerGain:Math.max(-2,centerDistance(move.from)-centerDistance(move.to)),
  develops:move.piece!=="p"&&game.history().length<16,
  castles:String(move.san).includes("O-O")
 };
 game.undo();
 return result;
}
function personalityPreference(move,position,plan,character,features){
 const brain=brainFor(character);
 let score=0;
 if(position.check)score+=24*brain.aggression+26*brain.tactics;
 if(features.isCapture)score+=16*brain.aggression+18*brain.material+24*brain.captureConfidence;
 if(features.isCapture&&features.captureGain<0)score+=44*brain.sacrifice-38*brain.pieceProtection;
 if(features.castles)score+=26*brain.kingSafety+18*brain.development;
 if(features.develops)score+=18*brain.positional+22*brain.development;
 if(features.central)score+=16*brain.positional;
 if(features.pawnAdvance)score+=10*brain.aggression;
 if(features.quiet)score+=12*(1-brain.aggression)+10*brain.positional+8*brain.patience;
 if(features.queenMove)score+=10*brain.queenPreference;
 score-=features.repeatCount*(18+34*brain.adaptability);
 for(const priority of plan.priorities){
  if(priority==="check"&&position.check)score+=24;
  if(priority==="capture"&&features.isCapture)score+=22;
  if(priority==="castle"&&features.castles)score+=28;
  if(priority==="kingSafety"&&features.castles)score+=22;
  if(priority==="developPiece"&&features.develops)score+=18;
  if(priority==="centralize")score+=position.centerGain*8;
  if(priority==="tradePieces"&&features.isCapture)score+=18*brain.simplification;
  if(priority==="reduceForcingReplies")score+=Math.max(-18,Math.min(18,(8-position.forcingReplies)*2));
  if(priority==="increaseForcingReplies")score+=Math.min(24,position.forcingReplies*4);
  if(priority==="advancePawn"&&features.pawnAdvance)score+=18;
 }
 return Math.max(-90,Math.min(90,score));
}
function perceivePosition(position,brain){
 const threatDifficulty=clamp01(position.forcingReplies/7);
 const pressurePenalty=threatDifficulty*(.34-.16*brain.composure-.1*brain.emotionalStability);
 const detection=clamp01(brain.threatDetection*.34+brain.vision*.22+brain.calculation*.25+brain.evaluation*.09+brain.spatial*.06+brain.practicalAccuracy*.04-pressurePenalty);
 const sawConsequences=seedRng()<detection;
 const consequencePenalty=sawConsequences?0:threatDifficulty*(45+95*(1-brain.calculation));
 const knowledge=brain.phaseKnowledge[position.phase]??brain.knowledgeAverage;
 const adaptationReduction=clamp01(brain.adaptability*.45+brain.learningSpeed*.25+brain.memory*.2)*.28;
 const evaluationNoise=(seedRng()-.5)*2*brain.evaluationNoise*(1-knowledge*.28-adaptationReduction);
 return {score:position.objectiveScore-consequencePenalty+evaluationNoise,sawConsequences,detection};
}
function perceivedCandidateScore(move,position,plan,character,features){
 const brain=brainFor(character);
 const perception=perceivePosition(position,brain);
 let skillScore=perception.score+position.material*(.45+.35*brain.material);
 const personalityScore=personalityPreference(move,position,plan,character,features)+memoryScore(move,character,position);
 let score=skillScore+personalityScore;
 if(position.mate)score=100000;
 if(position.draw){
  const advantage=materialBalance()*(move.color==="w"?1:-1);
  if(advantage>120)score-=180+360*brain.conversion;
  else if(advantage<-120)score+=60+120*(1-brain.aggression);
 }
 if(features.isCapture&&position.material>=250)score+=120+100*brain.evaluation;
 if(features.isCapture&&position.material>=500)score+=160;
 if(seedRng()<brain.blunderChance)score-=80+seedRng()*(110+brain.evaluationNoise*1.8);
 return {score,perception,skillScore,personalityScore};
}
function weightedOpeningChoice(options,freeformWeight){
 const total=options.reduce((sum,line)=>sum+line.weight,0)+freeformWeight;
 if(total<=0)return null;
 let roll=seedRng()*total;
 if(roll<freeformWeight)return null;
 roll-=freeformWeight;
 for(const line of options){
  roll-=line.weight;
  if(roll<=0)return line;
 }
 return options.at(-1)||null;
}
function openingProfileFor(character,color){
 return character.openingProfile?.[color==="w"?"white":"black"]||null;
}
function openingMove(character){
 const color=game.turn();
 const profile=openingProfileFor(character,color);
 if(!profile)return null;

 const history=game.history();
 let state=openingStates[color];

 if(state===undefined||state===null){
  const candidates=profile.lines.filter(line=>{
   if(history.length>=line.moves.length)return false;
   return history.every((san,index)=>line.moves[index]===san);
  });
  const line=weightedOpeningChoice(candidates,profile.freeformWeight||0);
  state=line?{name:line.name,moves:[...line.moves],active:true}:{active:false,freeform:true};
  openingStates[color]=state;
 }

 if(!state.active)return null;
 if(history.length>=state.moves.length){
  state.active=false;
  return null;
 }
 if(!history.every((san,index)=>state.moves[index]===san)){
  state.active=false;
  memoryForColor(color).openingDeviation=true;
  return null;
 }

 const expectedSan=state.moves[history.length];
 const legal=game.moves({verbose:true}).find(move=>move.san===expectedSan);
 if(!legal){
  state.active=false;
  memoryForColor(color).openingDeviation=true;
  return null;
 }

 character._openingName=state.name;
 character._usedOpeningMove=true;
 return legal;
}
async function chooseMove(c){
 const moves=game.moves({verbose:true});
 if(!moves.length)return null;
 c._usedOpeningMove=false;
 const bookMove=openingMove(c);
 if(bookMove){c._intent="openingPreparation";return bookMove;}
 const brain=brainFor(c);
 const analysis=analyzePosition(game.turn());
 const intent=selectIntent(c,analysis);
 const plan=buildPlan(intent,analysis);
 c._intent=intent;
 c._positionAnalysis=analysis;
 const discovery=discoverCandidates(c,moves,analysis,plan);
 const fen=game.fen();
 const candidateMoves=discovery.noticed.map(item=>item.move);
 const engineCandidates=await stockfish.analyze(fen,candidateMoves.map(moveToUci),{
  multiPV:Math.min(brain.stockfishMultiPV,candidateMoves.length),
  movetime:brain.analysisBudget
 });
 if(!engineCandidates?.length)throw new Error("Stockfish returned no candidate analysis.");
 const noticedByUci=new Map(discovery.noticed.map(item=>[moveToUci(item.move),item]));
 const ranked=engineCandidates.map(engine=>{
  const item=noticedByUci.get(engine.uci);
  if(!item)return null;
  const position=candidatePosition(item.move);
  position.objectiveScore=engine.objectiveScore;
  const perceived=perceivedCandidateScore(item.move,position,plan,c,item.features);
  return {m:item.move,s:perceived.score,position,features:item.features,perceived,engine};
 }).filter(Boolean).sort((a,b)=>b.s-a.s);
 if(!ranked.length)throw new Error("Stockfish candidate moves could not be matched to legal moves.");
 const phaseKnowledge=brain.phaseKnowledge[analysis.phase]??brain.knowledgeAverage;
 const competence=clamp01(brain.vision*.22+brain.calculation*.23+brain.evaluation*.2+brain.practicalAccuracy*.13+phaseKnowledge*.1+brain.confidence*.12);
 const breadth=Math.max(1,Math.min(ranked.length,Math.round(5-3*competence+brain.randomness*2+brain.intuitionReliance-brain.calculationReliance*.6)));
 const pool=ranked.slice(0,breadth);
 const temperature=.14+brain.randomness*.82+(1-competence)*.44+brain.intuitionReliance*.14-brain.calculationReliance*.08;
 const best=pool[0].s;
 const weights=pool.map(item=>Math.exp((item.s-best)/Math.max(16,48*temperature)));
 let roll=seedRng()*weights.reduce((sum,item)=>sum+item,0);
 let chosen=pool[0];
 for(let index=0;index<pool.length;index++){
  roll-=weights[index];
  if(roll<=0){chosen=pool[index];break;}
 }
 const objectiveBest=[...ranked].sort((a,b)=>b.engine.objectiveScore-a.engine.objectiveScore)[0];
 c._cognitiveTrace={
  intent,plan:plan.priorities.join(" → "),engine:STOCKFISH_SOURCE,
  estimatedElo:brain.estimatedElo,analysisBudget:brain.analysisBudget,multiPV:Math.min(brain.stockfishMultiPV,candidateMoves.length),
  confidence:Math.round(brain.confidence*100),vision:Math.round(brain.vision*100),
  calculation:Math.round(brain.calculation*100),evaluation:Math.round(brain.evaluation*100),
  risk:Math.round(brain.risk*100),chosen:chosen.m.san,
  legalCount:moves.length,noticedCount:discovery.noticed.length,analyzedCount:ranked.length,
  objectiveBest:objectiveBest?.m?.san||"—",
  sawConsequences:chosen.perceived.perception.sawConsequences,
  candidates:ranked.slice(0,8).map(item=>({
   san:item.m.san,score:Math.round(item.s),objective:Math.round(item.engine.objectiveScore),
   skill:Math.round(item.perceived.skillScore),personality:Math.round(item.perceived.personalityScore),forcingReplies:item.position.forcingReplies,
   sawConsequences:item.perceived.perception.sawConsequences
  })),
  missed:discovery.missed.slice(0,5).map(item=>item.move.san)
 };
 renderDiagnostics(c);
 return chosen.m;
}
function renderDiagnostics(character){
 const panel=$("#diagnosticsPanel");
 if(!panel||panel.hidden)return;
 const trace=character?._cognitiveTrace;
 if(!trace){$("#diagnosticsBody").textContent="No AI decision has been recorded yet.";return;}
 $("#diagnosticsBody").innerHTML=`
  <div class="diagnostic-grid">
   <div><span>Character</span><strong>${character.shortName||character.name}</strong></div>
   <div><span>Intent</span><strong>${String(trace.intent).replace(/([A-Z])/g," $1")}</strong></div>
   <div><span>Chosen move</span><strong>${trace.chosen}</strong></div>
   <div><span>Objective best</span><strong>${trace.objectiveBest}</strong></div>
   <div><span>Analysis engine</span><strong>${trace.engine}</strong></div>
   <div><span>Target Elo</span><strong>${trace.estimatedElo}</strong></div>
   <div><span>Stockfish budget</span><strong>${trace.analysisBudget} ms · MultiPV ${trace.multiPV}</strong></div>
   <div><span>Legal moves</span><strong>${trace.legalCount}</strong></div>
   <div><span>Moves noticed</span><strong>${trace.noticedCount}</strong></div>
   <div><span>Moves analyzed</span><strong>${trace.analyzedCount}</strong></div>
   <div><span>Saw reply tactics?</span><strong>${trace.sawConsequences?"Yes":"No"}</strong></div>
   <div><span>Vision</span><strong>${trace.vision}</strong></div>
   <div><span>Calculation</span><strong>${trace.calculation}</strong></div>
   <div><span>Evaluation</span><strong>${trace.evaluation}</strong></div>
   <div><span>Risk tolerance</span><strong>${trace.risk}</strong></div>
  </div>
  <p><b>Plan:</b> ${trace.plan}</p>
  <div class="candidate-list">${trace.candidates.map((item,index)=>`<div><span>${index+1}. ${item.san}${item.sawConsequences?"":" · consequence missed"}</span><span>${item.score} · objective ${item.objective} · skill ${item.skill} · personality ${item.personality}</span></div>`).join("")}</div>
  <p><b>Not considered:</b> ${trace.missed.length?trace.missed.join(", "):"None"}</p>`;
}
function moveEvent(move){
 if(game.isCheckmate())return "mate";
 if(game.isDraw())return "draw";
 if(game.inCheck())return "check";
 if(move?.captured)return "capture";
 if(game.history().length<=2)return "opening";
 const actorAdvantage=materialBalance()*(move.color==="w"?1:-1);
 if(actorAdvantage>250)return "winning";
 if(actorAdvantage<-250)return "losing";
 return "move";
}
function moodFor(c,event){
 const brain=brainFor(c);
 if(event==="mate")return "triumphant";
 if(event==="draw")return brain.aggression>.65?"frustrated":"calm";
 if(event==="losing")return "frustrated";
 if(event==="winning")return "confident";
 if(event==="check")return brain.pressure>.65?"confident":"excited";
 if(event==="capture")return brain.novelty>.7?"excited":"confident";
 if(event==="opening")return brain.novelty>.65?"curious":"focused";
 if(brain.novelty>.8)return "curious";
 if(brain.pressure>.78)return "confident";
 return "focused";
}
function reactionMood(move,opponent){
 if(game.isCheckmate())return "frustrated";
 if(game.inCheck())return "pressured";
 if(move?.captured)return brainFor(opponent).risk>.65?"focused":"pressured";
 return opponent._mood||"focused";
}
function expressionForMood(character,mood,event){
 const map={
  calm:"draw",
  focused:"move",
  curious:"opening",
  confident:"winning",
  excited:"capture",
  pressured:"checked",
  frustrated:"losing",
  triumphant:"mate"
 };
 const expressionEvent=map[mood]||event;
 return character.expressionMap?.[expressionEvent]
  ||character.expressionMap?.[event]
  ||character.defaultExpression
  ||"neutral";
}
function chooseLine(lines){
 return lines[Math.floor(seedRng()*lines.length)];
}
function dialogueFor(character,opponent,event,mood){
 const relationshipLines=character.relationships?.[opponent.id]?.[event];
 if(relationshipLines)return chooseLine(relationshipLines);
 const standardLines=character.dialogue[mood]||character.dialogue[event]||character.dialogue.move;
 return chooseLine(standardLines);
}
function contextualDialogueEvent(character,fallbackEvent){
 const memory=memoryForColor(characterColor(character));
 const contextual=memory.contextualEvent;
 memory.contextualEvent=null;
 if(!contextual)return fallbackEvent;
 const hasRelationship=character.relationships?.[character===config.white?config.black.id:config.white.id]?.[contextual];
 const hasStandard=character.dialogue?.[contextual];
 return hasRelationship||hasStandard?contextual:fallbackEvent;
}
function afterMove(move,autoContinue=true){
 const afterEval=materialBalance();
 game.undo();
 const beforeEval=materialBalance();
 game.move(move);
 updateMatchMemory(move,beforeEval,afterEval);
 renderBoard([move.from,move.to]);appendMove(move);
 const actor=move.color==="w"?config.white:config.black;
 const opponent=move.color==="w"?config.black:config.white;
 const side=move.color==="w"?"left":"right";
 const opponentSide=side==="left"?"right":"left";
 const event=moveEvent(move);
 const mood=moodFor(actor,event);
 const opponentMood=reactionMood(move,opponent);

 actor._mood=mood;
 opponent._mood=opponentMood;

 setCharacter(side,actor,expressionForMood(actor,mood,event));
 setCharacter(opponentSide,opponent,expressionForMood(opponent,opponentMood,"move"));
 const dialogueEvent=contextualDialogueEvent(actor,event);
 speak(actor,dialogueFor(actor,opponent,dialogueEvent,mood),side);
 $("#statusDetail").textContent=actor._usedOpeningMove
  ?`${actor.shortName||actor.name} follows ${actor._openingName}.`
  :`${actor.shortName||actor.name} pursues ${String(actor._intent||"improvePosition").replace(/([A-Z])/g," $1").toLowerCase()}.`;

 if(game.isGameOver()){finish();updateMoveControls();return}
 updateMoveControls();
 if(autoContinue)scheduleAi();
}
function speak(c,text,side){
 $("#leftCard").classList.toggle("active",side==="left");
 $("#rightCard").classList.toggle("active",side==="right");
 $(`#${side}Speech`).textContent=text;
}
function moveKind(move){
 if(move.san.endsWith("#"))return {type:"mate",icon:"♔",label:"Checkmate"};
 if(move.san.includes("+"))return {type:"check",icon:"⚡",label:"Check"};
 if(move.san.includes("O-O"))return {type:"castle",icon:"♜",label:"Castle"};
 if(move.promotion)return {type:"promotion",icon:"◆",label:"Promotion"};
 if(move.captured)return {type:"capture",icon:"⚔",label:"Capture"};
 return {type:"normal",icon:"",label:"Move"};
}
function clearMovePreview(){
 $$(".sq").forEach(square=>square.classList.remove("preview-from","preview-to"));
}
function previewMove(move){
 clearMovePreview();
 document.querySelector(`[data-square="${move.from}"]`)?.classList.add("preview-from");
 document.querySelector(`[data-square="${move.to}"]`)?.classList.add("preview-to");
}
function appendMove(m){
 const kind=moveKind(m);
 const el=document.createElement("div");
 el.className=`move ${kind.type}`;
 el.dataset.from=m.from;
 el.dataset.to=m.to;
 el.title=`${m.from} → ${m.to} • ${kind.label}`;
 el.innerHTML=`${kind.icon?`<span class="move-icon" aria-hidden="true">${kind.icon}</span>`:""}${Math.ceil(game.history().length/2)}${m.color==="w"?"." : "..."} ${m.san}`;
 el.addEventListener("mouseenter",()=>previewMove(m));
 el.addEventListener("mouseleave",clearMovePreview);
 $("#moves").appendChild(el);
}
function updateStatus(){
 $("#turnText").textContent=game.isGameOver()?"Game complete":`${game.turn()==="w"?config.white?.shortName||"White":config.black?.shortName||"Black"} to move`;
 $("#fenText").textContent=`Move ${Math.ceil((game.history().length+1)/2)}`;
 const ev=Math.max(-900,Math.min(900,materialBalance())),left=50+ev/36;
 $("#momentumLeft").style.width=`${left}%`;$("#momentumRight").style.width=`${100-left}%`;
 $("#leftMeter").style.width=`${left}%`;$("#rightMeter").style.width=`${100-left}%`;
 if(config.white&&config.black)updateMoveControls();
}

function delayLabel(ms){
 return ms<1000?`${ms} ms`:`${(ms/1000).toFixed(1)} s`;
}
function updateDelayLabel(){
 $("#delayValue").textContent=delayLabel(Number($("#delay").value));
}
function updateMoveControls(){
 const hasHistory=game.history().length>0;
 $("#lastMove").disabled=!hasHistory;
 $("#nextMove").disabled=game.isGameOver()||sideMode(game.turn())!=="ai";
}
function pauseMatch(){
 running=false;
 clearTimeout(timer);
 $("#play").textContent="▶ Run";
}
function stopForStockfishError(error){
 pauseMatch();
 const message=error?.message||String(error);
 console.error("AI stopped because Stockfish failed.",error);
 $("#statusDetail").textContent=`Stockfish error: ${message}`;
 $("#leftSpeech").textContent="Stockfish is unavailable.";
 $("#rightSpeech").textContent="AI play has stopped.";
 const panel=$("#diagnosticsPanel");
 if(panel){panel.hidden=false;$("#diagnosticsBody").textContent=`Stockfish error: ${message}`;}
}
async function playNextAiMove(){
 if(game.isGameOver()||sideMode(game.turn())!=="ai")return;
 pauseMatch();
 const c=game.turn()==="w"?config.white:config.black;
 try{
  const move=await chooseMove(c);
  if(move)afterMove(game.move(move),false);
 }catch(error){
  stopForStockfishError(error);
 }
}
function rebuildMatchMemory(){
 const history=game.history({verbose:true});
 matchMemory={w:freshMemory(),b:freshMemory()};
 const replay=new Chess();
 for(const recorded of history){
  const before=[...replay.board()].flat().reduce((sum,p)=>sum+(p?(p.color==="w"?1:-1)*value[p.type]:0),0);
  const made=replay.move(recorded);
  const after=[...replay.board()].flat().reduce((sum,p)=>sum+(p?(p.color==="w"?1:-1)*value[p.type]:0),0);
  const liveGame=game;
  game=replay;
  updateMatchMemory(made,before,after);
  game=liveGame;
 }
}
function rewindOneMove(){
 if(!game.history().length)return;
 pauseMatch();
 hideResult();
 clearMovePreview();
 clearOutcomeState();
 game.undo();
 rebuildMatchMemory();
 openingStates={w:null,b:null};
 delete config.white._openingName;
 delete config.black._openingName;
 delete config.white._usedOpeningMove;
 delete config.black._usedOpeningMove;
 selected=null;
 $("#moves").lastElementChild?.remove();
 $("#leftCard").classList.remove("active");
 $("#rightCard").classList.remove("active");

 const whiteMood=moodFor(config.white,"move");
 const blackMood=moodFor(config.black,"move");
 config.white._mood=whiteMood;
 config.black._mood=blackMood;
 setCharacter("left",config.white,expressionForMood(config.white,whiteMood,"move"));
 setCharacter("right",config.black,expressionForMood(config.black,blackMood,"move"));
 $("#leftSpeech").textContent="Reviewing the position...";
 $("#rightSpeech").textContent="Reviewing the position...";

 renderBoard();
 $("#statusDetail").textContent="Rewound one move";
 updateMoveControls();
}

function scheduleAi(){
 clearTimeout(timer);
 const mode=sideMode(game.turn());
 if(mode!=="ai"||game.isGameOver()){running=false;$("#play").textContent="▶ Run";return}
 running=true;$("#play").textContent="❚❚ Pause";
 timer=setTimeout(async()=>{
  if(!running)return;
  try{
   const c=game.turn()==="w"?config.white:config.black;
   const m=await chooseMove(c);
   if(m&&running){const made=game.move(m);afterMove(made)}
  }catch(error){
   stopForStockfishError(error);
  }
 },Math.max(120,Number($("#delay").value)*(1.35-.7*brainFor(game.turn()==="w"?config.white:config.black).moveSpeed)));
}
function clearOutcomeState(){
 ["leftCard","rightCard"].forEach(id=>{
  const card=$("#"+id);
  card.classList.remove("winner","loser","drawn");
 });
}
function setPostMatchLine(side,character,opponent,event){
 const mood=event==="win"?"triumphant":event==="draw"?"calm":"frustrated";
 const expressionEvent=event==="win"?"mate":event==="lose"?"losing":"draw";
 character._mood=mood;
 setCharacter(side,character,expressionForMood(character,mood,expressionEvent));
 $(`#${side}Speech`).textContent=dialogueFor(character,opponent,event,mood);
}
function showPostMatchReactions(){
 clearOutcomeState();

 if(game.isCheckmate()){
  const whiteWon=game.turn()==="b";
  const winner=whiteWon?config.white:config.black;
  const loser=whiteWon?config.black:config.white;
  const winnerSide=whiteWon?"left":"right";
  const loserSide=whiteWon?"right":"left";

  setPostMatchLine(winnerSide,winner,loser,"win");
  setPostMatchLine(loserSide,loser,winner,"lose");
  $(`#${winnerSide}Card`).classList.add("winner","active");
  $(`#${loserSide}Card`).classList.add("loser");
  $(`#${loserSide}Card`).classList.remove("active");
  return;
 }

 setPostMatchLine("left",config.white,config.black,"draw");
 setPostMatchLine("right",config.black,config.white,"draw");
 $("#leftCard").classList.add("drawn","active");
 $("#rightCard").classList.add("drawn","active");
}
function drawReason(){
 if(game.isStalemate?.())return "Stalemate";
 if(game.isThreefoldRepetition?.())return "Threefold repetition";
 if(game.isInsufficientMaterial?.())return "Insufficient material";
 return "Draw";
}
function hideResult(){
 $("#resultBanner").hidden=true;
}
function matchAnalysis(){
 const history=game.history({verbose:true});
 const captures=history.filter(move=>move.captured).length;
 const checks=history.filter(move=>move.san.includes("+")||move.san.endsWith("#")).length;
 const castles=history.filter(move=>move.san.includes("O-O"));
 const promotions=history.filter(move=>move.promotion).length;
 const queenMoves=history.filter(move=>move.piece==="q").length;
 const fullMoves=Math.ceil(history.length/2);

 const castleColors=[...new Set(castles.map(move=>move.color))];
 const castleText=castleColors.length===2?"Both":castleColors[0]==="w"?"White":castleColors[0]==="b"?"Black":"None";

 let nickname="Methodical Match";
 const captureRate=history.length?captures/history.length:0;
 if(checks>=7||captureRate>=.42)nickname="Tactical Duel";
 else if(captures>=12)nickname="Aggressive Match";
 else if(fullMoves>=45&&captures<=10)nickname="Patient Endgame";
 else if(queenMoves>=12)nickname="Queen-Led Battle";
 else if(castles.length===2&&captures<=8)nickname="Positional Contest";

 return {history,captures,checks,castleText,promotions,fullMoves,nickname};
}
function signatureScore(move,character,index){
 const brain=brainFor(character);
 let score=0;
 if(move.captured)score+=35+60*brain.aggression+(value[move.captured]||0)*.08;
 if(move.san.includes("+"))score+=45+80*brain.tactics+55*brain.pressure;
 if(move.san.endsWith("#"))score+=500;
 if(move.san.includes("O-O"))score+=50+90*brain.kingSafety;
 if(move.promotion)score+=150;
 if(["c4","c5","d4","d5","e4","e5","f4","f5"].includes(move.to))score+=35*brain.positional;
 if(move.piece==="q")score+=25*brain.queenPreference;
 score+=index*.12;
 return score;
}
function signatureDescription(move,character){
 const name=character.shortName||character.name;
 if(move.san.endsWith("#"))return `${name} delivered the finishing blow.`;
 if(move.promotion)return `${name} converted a pawn into decisive power.`;
 if(move.san.includes("+")&&move.captured)return `${name} combined a capture with direct pressure on the king.`;
 if(move.san.includes("+"))return `${name} seized the initiative with check.`;
 if(move.captured)return `${name} chose a forceful exchange that matched their style.`;
 if(move.san.includes("O-O"))return `${name} committed to king safety and structure.`;
 return `${name} chose the move that most closely matched their playing personality.`;
}
function winnerSignature(analysis){
 if(!game.isCheckmate())return null;
 const winnerColor=game.turn()==="w"?"b":"w";
 const winner=winnerColor==="w"?config.white:config.black;
 const candidates=analysis.history
  .map((move,index)=>({move,index}))
  .filter(item=>item.move.color===winnerColor);
 if(!candidates.length)return null;
 const best=candidates.sort((a,b)=>
  signatureScore(b.move,winner,b.index)-signatureScore(a.move,winner,a.index)
 )[0];
 return {
  notation:`${Math.ceil((best.index+1)/2)}${best.move.color==="w"?".":"..."} ${best.move.san}`,
  text:signatureDescription(best.move,winner)
 };
}
function renderMatchReview(){
 const analysis=matchAnalysis();
 $("#matchNickname").textContent=analysis.nickname;
 $("#resultStats").innerHTML=[
  ["Moves",analysis.fullMoves],
  ["Captures",analysis.captures],
  ["Checks",analysis.checks],
  ["Castled",analysis.castleText],
  ["Promotions",analysis.promotions]
 ].map(([label,value])=>`<div class="result-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

 const signature=winnerSignature(analysis);
 $("#signatureMove").hidden=!signature;
 if(signature){
  $("#signatureNotation").textContent=signature.notation;
  $("#signatureText").textContent=signature.text;
 }
}
function showResult(){
 const banner=$("#resultBanner");
 const moveCount=game.history().length;
 const fullMoves=Math.ceil(moveCount/2);

 if(game.isCheckmate()){
  const winner=game.turn()==="w"?config.black:config.white;
  const side=game.turn()==="w"?"Black":"White";
  banner.style.setProperty("--winner1",winner.theme.primary);
  banner.style.setProperty("--winner2",winner.theme.secondary);
  $("#resultMark").textContent="♔";
  $("#resultLabel").textContent="Checkmate";
  $("#resultTitle").textContent=`${winner.shortName||winner.name} wins`;
  $("#resultSummary").textContent=`${side} wins by checkmate • ${fullMoves} ${fullMoves===1?"move":"moves"}`;
 }else{
  banner.style.setProperty("--winner1","#7d748d");
  banner.style.setProperty("--winner2","#b8afc8");
  $("#resultMark").textContent="½";
  $("#resultLabel").textContent="Match drawn";
  $("#resultTitle").textContent="Draw";
  $("#resultSummary").textContent=`${drawReason()} • ${fullMoves} ${fullMoves===1?"move":"moves"}`;
 }

 renderMatchReview();
 banner.hidden=false;
}

function finish(){
 running=false;$("#play").textContent="▶ Run";
 let text=game.isCheckmate()?`${game.turn()==="w"?config.black.shortName:config.white.shortName} wins by checkmate.`:`The game ends in a ${drawReason().toLowerCase()}.`;
 $("#statusDetail").textContent=text;
 showPostMatchReactions();
 showResult();
}
function startGame(){
 hideResult();
 clearMovePreview();
 clearOutcomeState();
 openingStates={w:null,b:null};
 matchMemory={w:freshMemory(),b:freshMemory()};
 catalog.forEach(character=>{
  delete character._brain;
  delete character._mood;
  delete character._openingName;
  delete character._usedOpeningMove;
  delete character._cognitiveTrace;
 });
 config={
  white:chars[$("#whiteCharacter").value],black:chars[$("#blackCharacter").value],
  whiteMode:$("#mode").value==="hvh"?"human":$("#mode").value==="hva"?"human":"ai",
  blackMode:$("#mode").value==="hvh"?"human":"ai"
 };
 document.documentElement.style.setProperty("--left",config.white.theme.primary);document.documentElement.style.setProperty("--left2",config.white.theme.secondary);
 document.documentElement.style.setProperty("--right",config.black.theme.primary);document.documentElement.style.setProperty("--right2",config.black.theme.secondary);
 seedRng=$("#seed").value.trim()?seeded($("#seed").value.trim()):Math.random;
 game=new Chess();selected=null;$("#moves").innerHTML="";$("#statusDetail").textContent="Match initialized";
 config.white._mood=moodFor(config.white,"opening");
 config.black._mood=moodFor(config.black,"opening");
 setCharacter("left",config.white,expressionForMood(config.white,config.white._mood,"opening"));
 setCharacter("right",config.black,expressionForMood(config.black,config.black._mood,"opening"));
 $("#leftSpeech").textContent=dialogueFor(config.white,config.black,"opening",config.white._mood);
 $("#rightSpeech").textContent=dialogueFor(config.black,config.white,"opening",config.black._mood);
 $("#leftCard").classList.add("active");
 $("#rightCard").classList.add("active");
 $("#setupModal").hidden=true;createBoard();
 running=false;
 $("#play").textContent="▶ Run";
 updateMoveControls();
}
$("#setupBtn").onclick=()=>{$("#setupModal").hidden=false};
$("#cancelSetup").onclick=()=>{$("#setupModal").hidden=true};
$("#startMatch").onclick=startGame;
$("#swap").onclick=()=>{const a=$("#whiteCharacter").value;$("#whiteCharacter").value=$("#blackCharacter").value;$("#blackCharacter").value=a};
$("#play").onclick=()=>{running=!running;running?scheduleAi():pauseMatch()};
$("#lastMove").onclick=rewindOneMove;
$("#nextMove").onclick=playNextAiMove;
$("#delay").oninput=updateDelayLabel;
$("#diagnosticsToggle").onclick=()=>{
 const panel=$("#diagnosticsPanel");
 panel.hidden=!panel.hidden;
 $("#diagnosticsToggle").textContent=panel.hidden?"AI Diagnostics":"Hide Diagnostics";
 if(!panel.hidden)renderDiagnostics(game.turn()==="w"?config.white:config.black);
};
$("#newGame").onclick=()=>{
 pauseMatch();
 startGame();
};
try{
 await loadCharacters();
 updateDelayLabel();
 updateMoveControls();
 $("#setupModal").hidden=false;
}catch(error){
 console.error(error);
 $("#setupModal").hidden=false;
 $("#statusDetail").textContent=error.message;
 $("#leftSpeech").textContent="Load error.";$("#rightSpeech").textContent=error.message;
}
