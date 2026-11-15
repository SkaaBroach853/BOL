import type {Interpretation,Intent} from '../shared/contracts.ts';
import {intentSchema} from '../shared/contracts.ts';
import {Ledger} from './ledger.ts';
import {localIntent,resolveIntent} from './interpreter.ts';

// These are bounded, inspectable code agents, not an autonomous LLM with write tools.
export class InterpretationAgent {
  propose(transcript:string,ledger:Ledger):Intent{return intentSchema.parse(localIntent(transcript,ledger));}
}
export class ReviewAgent {
  review(intent:Intent,ledger:Ledger,targetId:string|null,source:string):Interpretation{return resolveIntent(intent,ledger,targetId,source);}
}
export class LedgerAgents {
  private interpretation=new InterpretationAgent();private review=new ReviewAgent();
  constructor(private ledger:Ledger){}
  run(transcript:string,targetId:string|null,inputType:'typed'|'voice'):Interpretation{
    return this.review.review(this.interpretation.propose(transcript,this.ledger),this.ledger,targetId,inputType==='voice'?'Local Whisper → BOL rule agents':'Typed input · BOL local rule agents');
  }
}
