
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
 const required=["corePersonality","chessAptitude","currentChessSkill","playstyle","signatureBehaviors","cognitiveModel"];
 if(!character.id)throw new Error(`${file} is missing id.`);
 if(!character.dialogue)throw new Error(`${character.id} is missing dialogue.`);
 if(!character.personalityProfile)throw new Error(`${character.id} is missing personalityProfile.`);
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
function evaluate(){
 let s=0;
 for(const row of game.board())for(const p of row)if(p)s+=(p.color==="w"?1:-1)*value[p.type];
 return s;
}
function staticEvaluation(color){
 const material=evaluate()*(color==="w"?1:-1);
 if(game.isCheckmate())return game.turn()===color?-100000:100000;
 if(game.isDraw())return 0;
 const mobility=game.moves().length*(game.turn()===color?1:-1);
 const checkPressure=game.inCheck()*(game.turn()===color?-28:28);
 return material+mobility*1.5+checkPressure;
}
function orderedMoves(){
 return game.moves({verbose:true}).sort((a,b)=>{
  const score=m=>(m.captured?value[m.captured]||0:0)+(String(m.san).includes("+")?80:0)+(String(m.san).includes("#")?10000:0);
  return score(b)-score(a);
 });
}
function minimax(depth,alpha,beta,rootColor){
 if(depth<=0||game.isGameOver())return staticEvaluation(rootColor);
 const maximizing=game.turn()===rootColor;
 const moves=orderedMoves();
 if(maximizing){
  let best=-Infinity;
  for(const move of moves){game.move(move);best=Math.max(best,minimax(depth-1,alpha,beta,rootColor));game.undo();alpha=Math.max(alpha,best);if(beta<=alpha)break;}
  return best;
 }
 let best=Infinity;
 for(const move of moves){game.move(move);best=Math.min(best,minimax(depth-1,alpha,beta,rootColor));game.undo();beta=Math.min(beta,best);if(beta<=alpha)break;}
 return best;
}
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const pct=n=>clamp01((Number(n)||0)/100);
function includesText(items,text){
 return (items||[]).some(item=>String(item).toLowerCase().includes(text));
}
function cognitiveValue(model,key,fallback=50){
 const value=Number(model?.[key]);
 return Number.isFinite(value)?Math.max(0,Math.min(100,value)):fallback;
}
function generateBrain(c){
 const p=c.personalityProfile;
 const core=p.corePersonality;
 const apt=p.chessAptitude;
 const styles=p.playstyle;
 const signatures=p.signatureBehaviors;
 const model=p.cognitiveModel;
 const tacticalStyle=includesText(styles,"tactical")||includesText(styles,"trickster");
 const strategicStyle=includesText(styles,"strategic")||includesText(styles,"positional");
 const chaoticStyle=includesText(styles,"chaotic")||includesText(styles,"creative");
 const defensiveStyle=includesText(styles,"defensive")||includesText(styles,"solid");
 const vision=pct(cognitiveValue(model,"vision"));
 const calculation=pct(cognitiveValue(model,"calculation"));
 const evaluation=pct(cognitiveValue(model,"evaluation"));
 const planning=pct(cognitiveValue(model,"planning"));
 const conversion=pct(cognitiveValue(model,"conversion"));
 const defense=pct(cognitiveValue(model,"defense"));
 const initiative=pct(cognitiveValue(model,"initiative"));
 const confidence=pct(cognitiveValue(model,"confidence"));
 const adaptability=pct(cognitiveValue(model,"adaptability"));
 const risk=pct(cognitiveValue(model,"riskTolerance"));
 const searchDepth=calculation>=.84?3:calculation>=.56?2:1;
 return {
  vision,calculation,evaluation,planning,conversion,defense,initiative,confidence,adaptability,risk,
  searchDepth,
  evaluationNoise:8+(1-evaluation)*86+(1-vision)*30,
  tacticalBlindness:clamp01((1-vision)*.62+(1-calculation)*.38),
  planReliability:clamp01(planning*.62+adaptability*.24+evaluation*.14),
  aggression:clamp01(pct(core.aggression)*.46+pct(core.competitiveness)*.16+initiative*.28+(includesText(styles,"aggressive")?.1:0)),
  tactics:clamp01(pct(apt.tacticalVision)*.32+pct(apt.patternRecognition)*.16+vision*.28+calculation*.16+(tacticalStyle?.08:0)),
  positional:clamp01(pct(apt.strategicPlanning)*.28+pct(apt.longTermPlanning)*.22+planning*.32+evaluation*.12+(strategicStyle?.06:0)),
  material:clamp01(.76-risk*.34-pct(core.curiosity)*.1),
  kingSafety:clamp01(defense*.58+pct(core.caution)*.26-risk*.18+(defensiveStyle?.12:0)),
  novelty:clamp01(pct(core.creativity)*.34+pct(core.curiosity)*.3+adaptability*.2+(chaoticStyle?.16:0)),
  randomness:clamp01(.04+(1-evaluation)*.28+(1-calculation)*.18+pct(core.impulsiveness)*.13),
  blunderChance:clamp01(.004+(1-vision)*.075+(1-calculation)*.055+(1-evaluation)*.03),
  complexity:clamp01(pct(core.creativity)*.22+risk*.26+pct(core.curiosity)*.18+initiative*.2+(chaoticStyle?.14:0)),
  queenPreference:includesText(signatures,"queen")?.95:.5,
  simplification:clamp01(defense*.34+pct(core.caution)*.28+planning*.2-risk*.18),
  pressure:clamp01(pct(core.bluffing)*.3+confidence*.22+initiative*.3+pct(core.aggression)*.12+(includesText(styles,"psychological")?.06:0))
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
  contextualEvent:null
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
 const candidates=[];
 const add=(id,score)=>candidates.push({id,score});
 if(analysis.inCheck)add("emergencyDefense",100);
 if(analysis.phase==="opening"&&analysis.development<.72)add("completeDevelopment",52+45*brain.positional);
 if(analysis.winning){
  add("technicalConversion",72+70*brain.conversion);
  add("restrictCounterplay",58+52*brain.kingSafety);
  add("simplify",44+62*brain.simplification);
 }
 if(analysis.losing){
  add("counterattack",45+70*brain.aggression+42*brain.pressure);
  add("createComplications",42+70*brain.complexity);
  add("reduceDanger",52+58*brain.kingSafety);
 }
 if(analysis.enemyKingExposure>.5)add("kingsideAttack",44+75*brain.aggression+45*brain.tactics);
 if(analysis.forcingMoves>=2)add("tacticalOpportunity",50+78*brain.tactics+32*brain.novelty);
 if(analysis.centerState==="closed"){
  add("improveWorstPiece",52+70*brain.positional);
  add("pawnBreak",38+48*brain.aggression+32*brain.novelty);
 }
 if(analysis.centerState==="open")add("seizeInitiative",45+62*brain.pressure+42*brain.tactics);
 if(analysis.kingSafety<.55)add("reduceDanger",66+70*brain.kingSafety);
 if(analysis.passedPawnPotential)add("advancePassedPawn",48+58*brain.conversion);
 add("improvePosition",46+62*brain.positional);
 add("createComplications",28+64*brain.complexity+36*brain.novelty);
 candidates.sort((a,b)=>b.score-a.score);
 analysis.candidateIntents=candidates.slice(0,4);
 const top=candidates.slice(0,Math.min(3,candidates.length));
 const best=top[0].score;
 const temperature=18+(1-brain.planning)*34+brain.randomness*24;
 const weights=top.map(item=>Math.exp((item.score-best)/temperature));
 let roll=seedRng()*weights.reduce((sum,item)=>sum+item,0);
 for(let index=0;index<top.length;index++){
  roll-=weights[index];
  if(roll<=0)return top[index].id;
 }
 return top[0].id;
}
function buildPlan(intent,analysis){
 const plans={
  emergencyDefense:{priorities:["escapeCheck","tradeAttackers","kingSafety"]},
  completeDevelopment:{priorities:["developPiece","castle","controlCenter"]},
  technicalConversion:{priorities:["preserveAdvantage","tradeWhenSafe","advancePassedPawn"]},
  restrictCounterplay:{priorities:["reduceForcingReplies","kingSafety","controlCenter"]},
  simplify:{priorities:["tradePieces","avoidDrawWhileWinning","reduceForcingReplies"]},
  counterattack:{priorities:["check","capture","createThreat"]},
  createComplications:{priorities:["increaseForcingReplies","check","novelMove"]},
  reduceDanger:{priorities:["kingSafety","tradeAttackers","reduceForcingReplies"]},
  kingsideAttack:{priorities:["check","moveTowardEnemyKing","increaseForcingReplies"]},
  tacticalOpportunity:{priorities:["mate","check","capture"]},
  improveWorstPiece:{priorities:["developPiece","centralize","avoidRepeat"]},
  pawnBreak:{priorities:["centralPawnMove","capture","openLines"]},
  seizeInitiative:{priorities:["check","developWithTempo","centralize"]},
  advancePassedPawn:{priorities:["advancePawn","supportPawn","tradePieces"]},
  improvePosition:{priorities:["centralize","developPiece","kingSafety"]}
 };
 return {intent,phase:analysis.phase,priorities:plans[intent]?.priorities||plans.improvePosition.priorities};
}
function chessScore(move,character){
 const brain=brainFor(character);
 const actor=move.color;
 const before=evaluate();
 game.move(move);
 const after=evaluate();
 const replies=game.moves({verbose:true});
 const terminalDraw=game.isDraw();
 const terminalMate=game.isCheckmate();
 const searchScore=terminalMate?100000:terminalDraw?0:minimax(Math.max(0,brain.searchDepth-1),-Infinity,Infinity,actor);
 const result={
  material:actor==="w"?after-before:before-after,
  check:game.inCheck(),mate:terminalMate,draw:terminalDraw,
  repetition:typeof game.isThreefoldRepetition==="function"&&game.isThreefoldRepetition(),
  stalemate:typeof game.isStalemate==="function"&&game.isStalemate(),
  replyCount:replies.length,
  forcingReplies:replies.filter(reply=>reply.captured||String(reply.san).includes("+")).length,
  searchScore,
  centerGain:Math.max(-2,centerDistance(move.from)-centerDistance(move.to)),
  develops:move.piece!=="p"&&game.history().length<16,
  castles:String(move.san).includes("O-O")
 };
 game.undo();
 return result;
}
function planScore(move,position,plan,character){
 const brain=brainFor(character);
 const movingValue=value[move.piece]||0;
 const currentAdvantage=evaluate()*(move.color==="w"?1:-1);
 let score=position.searchScore+position.material*(.35+brain.material*.35);
 if(position.mate)score+=100000;
 if(position.check)score+=58+80*brain.tactics;
 if(move.captured)score+=(value[move.captured]||0)*(.12+.24*brain.material)-movingValue*.012*brain.risk;
 for(const priority of plan.priorities){
  if(priority==="escapeCheck"&&!position.draw)score+=95;
  if(priority==="mate"&&position.mate)score+=100000;
  if(priority==="check"&&position.check)score+=42+55*brain.pressure;
  if(priority==="capture"&&move.captured)score+=28+36*brain.aggression;
  if(priority==="castle"&&position.castles)score+=62+70*brain.kingSafety;
  if(priority==="kingSafety"&&position.castles)score+=52+65*brain.kingSafety;
  if(priority==="developPiece"&&position.develops)score+=22+42*brain.positional;
  if(priority==="centralize")score+=position.centerGain*(12+22*brain.positional);
  if(priority==="controlCenter"&&["c4","c5","d4","d5","e4","e5","f4","f5"].includes(move.to))score+=22+28*brain.positional;
  if(priority==="centralPawnMove"&&move.piece==="p"&&["c","d","e","f"].includes(move.from[0]))score+=30+30*brain.aggression;
  if(priority==="advancePawn"&&move.piece==="p")score+=24+28*brain.conversion;
  if(priority==="tradePieces"&&move.captured)score+=26+50*brain.simplification;
  if(priority==="tradeAttackers"&&move.captured)score+=22+46*brain.kingSafety;
  if(priority==="reduceForcingReplies")score+=(18-position.forcingReplies)*2.1;
  if(priority==="increaseForcingReplies")score+=position.forcingReplies*4.2+position.replyCount*1.1;
  if(priority==="moveTowardEnemyKing"&&position.check)score+=34+40*brain.aggression;
  if(priority==="novelMove")score+=position.replyCount*1.4*brain.novelty;
  if(priority==="preserveAdvantage"&&currentAdvantage>120)score+=position.searchScore*.12*brain.conversion;
  if(priority==="avoidDrawWhileWinning"&&currentAdvantage>120&&(position.draw||position.repetition||position.stalemate))score-=520*brain.conversion;
  if(priority==="avoidRepeat"&&position.repetition)score-=170;
 }
 if(position.draw){
  if(currentAdvantage>120)score-=240+430*brain.conversion;
  else if(currentAdvantage<-120)score+=90+160*(1-brain.aggression);
  else score+=brain.aggression>.65?-85:18;
 }
 return score;
}
function perceivedCandidateScore(move,position,plan,character){
 const brain=brainFor(character);
 const objective=position.searchScore+position.material*(.35+brain.material*.35);
 const planned=planScore(move,position,plan,character)+memoryScore(move,character,position);
 let score=objective+(planned-objective)*brain.planReliability;
 let noise=(seedRng()-.5)*2*brain.evaluationNoise;
 if(plan.intent==="kingsideAttack"&&position.check)noise+=brain.evaluationNoise*.24*brain.confidence;
 if(plan.intent==="reduceDanger"&&position.castles)noise+=brain.evaluationNoise*.18*brain.defense;
 if(plan.intent==="createComplications"&&position.replyCount>18)noise+=brain.evaluationNoise*.2*brain.risk;
 if(position.forcingReplies>0&&seedRng()<brain.tacticalBlindness){
  score-=position.forcingReplies*(18+52*brain.tacticalBlindness);
 }
 if(move.captured&&seedRng()<brain.tacticalBlindness*.22){
  score-=(value[move.captured]||0)*(.12+.2*brain.tacticalBlindness);
 }
 score+=noise;
 if(seedRng()<brain.blunderChance)score-=100+seedRng()*(130+brain.evaluationNoise*2.4);
 return score;
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
function chooseMove(c){
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
 const ranked=moves.map(move=>{
  const position=chessScore(move,c);
  return {m:move,s:perceivedCandidateScore(move,position,plan,c),position};
 }).sort((a,b)=>b.s-a.s);
 const cognitiveControl=clamp01(brain.vision*.34+brain.calculation*.36+brain.evaluation*.3);
 const breadth=Math.max(1,Math.min(ranked.length,Math.round(7-5*cognitiveControl+brain.randomness*2.5)));
 const pool=ranked.slice(0,breadth);
 const temperature=.22+brain.randomness*1.05+(1-cognitiveControl)*.55+(1-brain.confidence)*.18;
 const best=pool[0].s;
 const weights=pool.map(item=>Math.exp((item.s-best)/Math.max(18,55*temperature)));
 let roll=seedRng()*weights.reduce((sum,item)=>sum+item,0);
 let chosen=pool[0];
 for(let index=0;index<pool.length;index++){
  roll-=weights[index];
  if(roll<=0){chosen=pool[index];break;}
 }
 c._cognitiveTrace={
  intent,plan:plan.priorities.join(" → "),
  confidence:Math.round(brain.confidence*100),vision:Math.round(brain.vision*100),
  calculation:Math.round(brain.calculation*100),evaluation:Math.round(brain.evaluation*100),
  risk:Math.round(brain.risk*100),chosen:chosen.m.san,
  candidates:ranked.slice(0,5).map(item=>({san:item.m.san,score:Math.round(item.s),forcingReplies:item.position.forcingReplies}))
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
   <div><span>Confidence</span><strong>${trace.confidence}%</strong></div>
   <div><span>Vision</span><strong>${trace.vision}</strong></div>
   <div><span>Calculation</span><strong>${trace.calculation}</strong></div>
   <div><span>Evaluation</span><strong>${trace.evaluation}</strong></div>
   <div><span>Risk tolerance</span><strong>${trace.risk}</strong></div>
  </div>
  <p><b>Plan:</b> ${trace.plan}</p>
  <div class="candidate-list">${trace.candidates.map((item,index)=>`<div><span>${index+1}. ${item.san}</span><span>${item.score} · ${item.forcingReplies} forcing replies</span></div>`).join("")}</div>`;
}
function moveEvent(move){
 if(game.isCheckmate())return "mate";
 if(game.isDraw())return "draw";
 if(game.inCheck())return "check";
 if(move?.captured)return "capture";
 if(game.history().length<=2)return "opening";
 const actorAdvantage=evaluate()*(move.color==="w"?1:-1);
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
 const afterEval=evaluate();
 game.undo();
 const beforeEval=evaluate();
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
 const ev=Math.max(-900,Math.min(900,evaluate())),left=50+ev/36;
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
function playNextAiMove(){
 if(game.isGameOver()||sideMode(game.turn())!=="ai")return;
 pauseMatch();
 const c=game.turn()==="w"?config.white:config.black;
 const move=chooseMove(c);
 if(move)afterMove(game.move(move),false);
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
 timer=setTimeout(()=>{
  if(!running)return;
  const c=game.turn()==="w"?config.white:config.black,m=chooseMove(c);
  if(m){const made=game.move(m);afterMove(made)}
 },Number($("#delay").value));
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
