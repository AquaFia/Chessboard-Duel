
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const glyph={w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}};
const value={p:100,n:320,b:330,r:500,q:900,k:0};
let catalog=[], chars={}, game=new Chess(), config={}, selected=null, running=false, timer=null, seedRng=Math.random, openingStates={w:null,b:null}, matchMemory={w:null,b:null};

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
 if(!Number.isFinite(character.personalityProfile.estimatedElo))throw new Error(`${character.id} personalityProfile is missing estimatedElo.`);
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

function computeMaterialBalance(){
 let score=0;
 for(const row of game.board())for(const piece of row)if(piece)score+=(piece.color==="w"?1:-1)*value[piece.type];
 return score;
}
function profileValue(section,key,fallback=50){
 const raw=section?.[key];
 return Number.isFinite(raw)?Math.max(0,Math.min(100,raw))/100:fallback/100;
}
function generateBrain(character){
 const profile=character.personalityProfile;
 const core=profile.corePersonality;
 const aptitude=profile.chessAptitude;
 const skill=profile.currentChessSkill;
 const behavior=profile.behaviorModel;
 const decision=profile.decisionModel;
 const estimatedElo=profile.estimatedElo;
 const phaseKnowledge={opening:profileValue(skill,"openingKnowledge"),middlegame:profileValue(skill,"middlegameKnowledge"),endgame:profileValue(skill,"endgameKnowledge")};
 return {
  estimatedElo,
  aggression:profileValue(core,"aggression"),risk:profileValue(core,"riskTolerance"),patience:profileValue(core,"patience"),
  creativity:profileValue(core,"creativity"),confidence:profileValue(core,"confidence"),adaptability:profileValue(core,"adaptability"),
  discipline:profileValue(core,"discipline"),impulsiveness:profileValue(core,"impulsiveness"),emotionalStability:profileValue(core,"emotionalStability"),
  calculation:profileValue(skill,"calculation"),evaluation:profileValue(skill,"evaluationAccuracy"),practicalAccuracy:profileValue(skill,"practicalAccuracy"),
  candidateAwareness:profileValue(skill,"candidateAwareness"),threatDetection:profileValue(skill,"threatDetection"),tacticalVision:profileValue(skill,"tacticalVision"),
  planning:profileValue(skill,"planning"),conversion:profileValue(skill,"conversion"),timeManagement:profileValue(skill,"timeManagement"),phaseKnowledge,
  patternRecognition:profileValue(aptitude,"patternRecognition"),spatialReasoning:profileValue(aptitude,"spatialReasoning"),intuition:profileValue(aptitude,"intuition"),
  captureConfidence:profileValue(behavior,"captureConfidence"),simplification:profileValue(behavior,"simplificationPreference"),
  complication:profileValue(behavior,"complicationPreference"),initiative:profileValue(behavior,"initiativePreference"),defense:profileValue(behavior,"defensivePreference"),
  material:profileValue(behavior,"materialGreed"),sacrifice:profileValue(behavior,"sacrificeWillingness"),queenPreference:profileValue(behavior,"queenActivity"),
  pieceProtection:profileValue(behavior,"pieceProtection"),development:profileValue(behavior,"developmentPriority"),
  intuitionReliance:profileValue(decision,"intuitionReliance"),calculationReliance:profileValue(decision,"calculationReliance"),
  planCommitment:profileValue(decision,"planCommitment"),planFlexibility:profileValue(decision,"planFlexibility"),psychologicalPlay:profileValue(decision,"psychologicalPlay"),
  moveSpeed:profileValue(decision,"moveSpeed"),overthinking:profileValue(decision,"overthinking"),
  tactics:profileValue(skill,"tacticalVision"),pressure:profileValue(behavior,"initiativePreference"),
  kingSafety:profileValue(behavior,"defensivePreference"),positional:profileValue(skill,"planning"),
  novelty:profileValue(core,"creativity")
 };
}
function brainFor(character){return character._brain||(character._brain=generateBrain(character));}
function freshMemory(){return {lastPiece:null,lastTo:null,repeatedPieceMoves:0,openingDeviation:false,contextualEvent:null};}
function memoryForColor(color){return matchMemory[color]||(matchMemory[color]=freshMemory());}
function characterColor(character){return character===config.white?"w":"b";}
function updateMatchMemory(move){
 const memory=memoryForColor(move.color);
 memory.repeatedPieceMoves=memory.lastPiece===move.piece?memory.repeatedPieceMoves+1:0;
 memory.lastPiece=move.piece;memory.lastTo=move.to;
}

const STOCKFISH_URL="https://unpkg.com/stockfish@18.0.8/bin/stockfish-18-asm.js";
class StockfishService{
 constructor(){this.worker=null;this.readyPromise=null;this.pending=null;}
 async ready(){
  if(this.readyPromise)return this.readyPromise;
  this.readyPromise=(async()=>{
   const response=await fetch(STOCKFISH_URL);
   if(!response.ok)throw new Error(`Stockfish download failed from ${STOCKFISH_URL} (${response.status} ${response.statusText})`);
   const source=await response.text();
   const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));
   this.worker=new Worker(url);
   URL.revokeObjectURL(url);
   this.worker.onmessage=event=>this.handle(String(event.data||""));
   this.worker.onerror=event=>{if(this.pending){this.pending.reject(new Error(event.message||"Stockfish worker failed"));this.pending=null;}};
   await this.commandUntil("uci","uciok");
   await this.commandUntil("isready","readyok");
  })();
  return this.readyPromise;
 }
 send(command){this.worker.postMessage(command);}
 commandUntil(command,token){return new Promise((resolve,reject)=>{this.pending={type:"token",token,resolve,reject};this.send(command);});}
 handle(line){
  const pending=this.pending;if(!pending)return;
  if(pending.type==="token"&&line.includes(pending.token)){this.pending=null;pending.resolve();return;}
  if(pending.type!=="analysis")return;
  if(line.startsWith("info ")){
   const parsed=parseStockfishInfo(line);
   if(parsed)pending.lines.set(parsed.multipv,parsed);
  }
  if(line.startsWith("bestmove ")){this.pending=null;pending.resolve([...pending.lines.values()].sort((a,b)=>a.multipv-b.multipv));}
 }
 async analyze(fen,{depth,multipv}){
  await this.ready();
  if(this.pending)throw new Error("Stockfish received overlapping analysis requests.");
  this.send("ucinewgame");this.send(`setoption name MultiPV value ${multipv}`);this.send(`position fen ${fen}`);
  return new Promise((resolve,reject)=>{this.pending={type:"analysis",lines:new Map(),resolve,reject};this.send(`go depth ${depth}`);});
 }
}
function parseStockfishInfo(line){
 const depth=Number(line.match(/\bdepth (\d+)/)?.[1]||0);
 const multipv=Number(line.match(/\bmultipv (\d+)/)?.[1]||1);
 const cp=line.match(/\bscore cp (-?\d+)/);const mate=line.match(/\bscore mate (-?\d+)/);
 const pv=line.match(/\bpv (.+)$/)?.[1]?.trim().split(/\s+/)||[];
 if(!pv.length||(!cp&&!mate))return null;
 const score=mate?Math.sign(Number(mate[1]))*(100000-Math.min(999,Math.abs(Number(mate[1])))*100):Number(cp[1]);
 return {depth,multipv,score,mate:mate?Number(mate[1]):null,pv};
}
const stockfish=new StockfishService();
function analysisBudget(character){
 const brain=brainFor(character),elo=brain.estimatedElo;
 const baseDepth=Math.round(8+(elo-600)/190);
 const depth=Math.max(7,Math.min(20,baseDepth+Math.round((brain.calculation-.5)*4+(brain.timeManagement-.5)*2)));
 const multipv=Math.max(3,Math.min(10,Math.round(3+(brain.candidateAwareness*5)+(brain.evaluation*2))));
 return {depth,multipv};
}
function uciToLegalMove(uci){
 const from=uci.slice(0,2),to=uci.slice(2,4),promotion=uci[4]||"q";
 return game.moves({verbose:true}).find(move=>move.from===from&&move.to===to&&(!move.promotion||move.promotion===promotion))||null;
}
function moveStyleFeatures(move){
 return {
  capture:Boolean(move.captured),check:move.san.includes("+"),mate:move.san.includes("#"),castle:move.san.includes("O-O"),
  queen:move.piece==="q",pawn:move.piece==="p",develop:move.piece!=="p"&&game.history().length<16,
  sacrifice:Boolean(move.captured)&&((value[move.captured]||0)<(value[move.piece]||0)),quiet:!move.captured&&!move.san.includes("+")
 };
}
function characterAdjustment(move,engineScore,character){
 const b=brainFor(character),f=moveStyleFeatures(move);let score=0;const notes=[];
 const add=(amount,label)=>{if(Math.abs(amount)>=1){score+=amount;notes.push(`${label} ${amount>0?"+":""}${Math.round(amount)}`);}};
 if(f.capture)add(20*(b.captureConfidence-.5)+14*(b.material-.5),"capture");
 if(f.check)add(24*(b.aggression-.5)+18*(b.initiative-.5),"forcing play");
 if(f.castle)add(28*(b.defense-.5)+18*(b.development-.5),"king safety");
 if(f.develop)add(20*(b.development-.5)+12*(b.planning-.5),"development");
 if(f.queen)add(16*(b.queenPreference-.5),"queen activity");
 if(f.sacrifice)add(30*(b.sacrifice-.5)+18*(b.complication-.5)-18*(b.pieceProtection-.5),"sacrifice");
 if(f.quiet)add(15*(b.patience-.5)+12*(b.planning-.5)-12*(b.impulsiveness-.5),"quiet play");
 if(Math.abs(engineScore)<80)add(12*(b.psychologicalPlay-.5)+10*(b.creativity-.5),"practical choice");
 return {score:Math.max(-70,Math.min(70,score)),notes};
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

async function chooseMove(character){
 const legal=game.moves({verbose:true});if(!legal.length)return null;
 character._usedOpeningMove=false;
 const bookMove=openingMove(character);
 if(bookMove){character._intent="openingPreparation";character._cognitiveTrace={source:"opening book",chosen:bookMove.san};renderDiagnostics(character);return bookMove;}
 const budget=analysisBudget(character);
 const raw=await stockfish.analyze(game.fen(),budget);
 const side=game.turn();
 const candidates=raw.map(entry=>{
  const move=uciToLegalMove(entry.pv[0]);if(!move)return null;
  const objective=side==="w"?entry.score:-entry.score;
  const style=characterAdjustment(move,objective,character);
  return {move,objective,style,total:objective+style.score,depth:entry.depth,mate:entry.mate,pv:entry.pv};
 }).filter(Boolean);
 if(!candidates.length)throw new Error("Stockfish returned no legal candidate move.");
 const brain=brainFor(character);
 const tolerance=Math.round(15+(1-brain.practicalAccuracy)*110+(1-brain.evaluation)*55);
 const bestObjective=Math.max(...candidates.map(item=>item.objective));
 const eligible=candidates.filter(item=>bestObjective-item.objective<=tolerance).sort((a,b)=>b.total-a.total);
 const chosen=eligible[0]||candidates[0];
 character._intent="stockfishGuidedChoice";
 character._cognitiveTrace={source:"Stockfish 18",chosen:chosen.move.san,objectiveBest:candidates[0].move.san,depth:budget.depth,multipv:budget.multipv,tolerance,candidates:candidates.map(item=>({san:item.move.san,objective:item.objective,character:item.style.score,total:item.total,notes:item.style.notes}))};
 renderDiagnostics(character);return chosen.move;
}
function renderDiagnostics(character){
 const panel=$("#diagnosticsPanel");if(!panel||panel.hidden)return;
 const trace=character?._cognitiveTrace;if(!trace){$("#diagnosticsBody").textContent="No AI decision has been recorded yet.";return;}
 if(trace.source==="opening book"){$("#diagnosticsBody").innerHTML=`<p><b>Source:</b> Character opening book</p><p><b>Chosen move:</b> ${trace.chosen}</p>`;return;}
 $("#diagnosticsBody").innerHTML=`
  <div class="diagnostic-grid">
   <div><span>Engine</span><strong>${trace.source}</strong></div><div><span>Depth</span><strong>${trace.depth}</strong></div>
   <div><span>MultiPV</span><strong>${trace.multipv}</strong></div><div><span>Chosen</span><strong>${trace.chosen}</strong></div>
   <div><span>Objective best</span><strong>${trace.objectiveBest}</strong></div><div><span>Style tolerance</span><strong>${trace.tolerance} cp</strong></div>
  </div>
  <div class="candidate-list">${trace.candidates.map((item,index)=>`<div><span>${index+1}. ${item.san}${item.notes.length?` · ${item.notes.join(", ")}`:""}</span><span>SF ${item.objective} · character ${item.character>=0?"+":""}${Math.round(item.character)} · total ${Math.round(item.total)}</span></div>`).join("")}</div>`;
}
function moveEvent(move){
 if(game.isCheckmate())return "mate";
 if(game.isDraw())return "draw";
 if(game.inCheck())return "check";
 if(move?.captured)return "capture";
 if(game.history().length<=2)return "opening";
 const actorAdvantage=computeMaterialBalance()*(move.color==="w"?1:-1);
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
 updateMatchMemory(move);
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
 const ev=Math.max(-900,Math.min(900,computeMaterialBalance())),left=50+ev/36;
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
async function playNextAiMove(){
 if(game.isGameOver()||sideMode(game.turn())!=="ai")return;
 pauseMatch();
 const c=game.turn()==="w"?config.white:config.black;
 try{const move=await chooseMove(c);if(move)afterMove(game.move(move),false);}catch(error){handleEngineFailure(error);}
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

function handleEngineFailure(error){
 pauseMatch();
 console.error(error);
 $("#statusDetail").textContent=`Stockfish unavailable: ${error.message}`;
 const body=$("#diagnosticsBody");if(body)body.textContent=`Stockfish unavailable: ${error.message}`;
}
function scheduleAi(){
 clearTimeout(timer);
 const mode=sideMode(game.turn());
 if(mode!=="ai"||game.isGameOver()){running=false;$("#play").textContent="▶ Run";return}
 running=true;$("#play").textContent="❚❚ Pause";
 timer=setTimeout(async()=>{
  if(!running)return;
  const c=game.turn()==="w"?config.white:config.black;
  try{const move=await chooseMove(c);if(move){const made=game.move(move);afterMove(made)}}catch(error){handleEngineFailure(error);}
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
