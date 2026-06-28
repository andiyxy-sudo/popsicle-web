// Auto-extracted demo account data from the prototype (source of truth).
// Used by the Account 360 panel and the Pulse/Portfolio/Signals screens.

export interface RawAccount {
  spark?: number[]
  name: string
  contact: string
  arr: string
  health: number
  risk: string
  riskClass: string
  arrColor: string
  stage: string
  signals: number
  dark: number
  rep: string
  brief?: string[]
  briefTypes?: string[]
  sigItems?: { sev: string; msg: string; time: string; via: string }[]
  comms?: { from: string; role: string; msg: string; time: string; via: string; dir: string; signal?: string; signalColor?: string; draft?: { tone: string; body: string }[] }[]
  people?: { name: string; role: string; badge?: string; badgeColor?: string; status: string; statusColor: string; last: string; eng: number; desc?: string }[]
  healthBars?: { label: string; val: number; color: string }[]
  timeline?: { title: string; time: string; desc: string; color: string }[]
  contracts?: { name: string; type: string; status: string; statusColor: string; value: string; po: string; start: string; end: string; invoice: string }[]
}

export const DEMO_ACCOUNTS: Record<string, RawAccount> = {
  acme:{spark:[55,50,48,42,36,28,20],name:'Acme Corp',contact:'Sarah Chen · CFO',arr:'$480K',health:31,risk:'HIGH',riskClass:'rhi',arrColor:'var(--danger)',stage:'Negotiation',signals:14,dark:8,rep:'Andy G',
    brief:['CRO hasn\'t responded to last 3 emails in 8 days - engagement dropped from 82 to 14','CFO flagged pricing concern in last call - finance loop-in may add 3-4 weeks','VP Eng confirmed technical fit - integration team standing by','Competitor (Gong) mentioned in 2 comms this month - evaluation likely underway'],
    briefTypes:['danger','warn','ok','danger'],
    sigItems:[{sev:'danger',msg:'Email opened 3× without reply - 8 days dark',time:'12m',via:'Gmail'},{sev:'danger',msg:'Competitor mentioned in Slack #sales channel',time:'2h',via:'Slack'},{sev:'warn',msg:'CFO requested pricing breakdown via WhatsApp',time:'1d',via:'WhatsApp'},{sev:'ok',msg:'VP Eng confirmed technical requirements met',time:'3d',via:'Zoom'}],
    comms:[{from:'Sarah Chen',role:'CFO',msg:'Thanks for the proposal. I need to run this by our finance team before we can commit.',time:'8d ago',via:'Gmail',dir:'in'},{from:'You',role:'',msg:'Hi Sarah - following up on the pricing discussion. Happy to walk through the ROI model.',time:'6d ago',via:'Gmail',dir:'out'},{from:'Marcus Rivera',role:'VP Eng',msg:'Technical eval looks solid. We\'re ready from an engineering standpoint.',time:'5d ago',via:'Slack',dir:'in'},{from:'You',role:'',msg:'Sarah - noticed you\'ve reviewed the proposal a few times. Any questions I can help with?',time:'3d ago',via:'Gmail',dir:'out'}],
    people:[{name:'Sarah Chen',role:'CFO',badge:'DECISION MAKER',badgeColor:'var(--danger)',status:'Disengaged',statusColor:'var(--danger)',last:'8d ago',eng:32,desc:'Primary blocker. Raised pricing objection. Needs exec-to-exec engagement.'},{name:'Marcus Rivera',role:'VP Eng',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Active',statusColor:'var(--ok)',last:'5d ago',eng:88,desc:'Strong internal advocate. Confirmed technical fit. Ready to push forward.'},{name:'James Yeo',role:'CTO',badge:'INFLUENCER',badgeColor:'var(--blue)',status:'Neutral',statusColor:'var(--t3)',last:'12d ago',eng:55,desc:'Controls vendor approval. Waiting on legal redlines.'},{name:'Rachel Kim',role:'Legal Counsel',badge:'BLOCKER',badgeColor:'var(--danger)',status:'Silent',statusColor:'var(--danger)',last:'9d ago',eng:20,desc:'Reviewing contract redlines. No response since Nov 14.'}],
    healthBars:[{label:'Engagement',val:32,color:'var(--danger)'},{label:'Product Fit',val:88,color:'var(--ok)'},{label:'Legal',val:45,color:'var(--warn)'},{label:'Financial',val:58,color:'var(--warn)'}],
    timeline:[{title:'Popsicle Deployed Response',time:'4h ago',desc:'Re-engagement email auto-sent to Sarah Chen. ROI value summary attached.',color:'var(--o)'},{title:'CFO Flagged Pricing',time:'2d ago',desc:'"We need to discuss pricing before committing." Finance concerns raised.',color:'var(--danger)'},{title:'Zoom Call · Discovery',time:'3d ago',desc:'42 min call with Sarah Chen & team. AI detected 2 objections, 1 commitment.',color:'var(--blue)'},{title:'Champion at Risk',time:'4d ago',desc:'Internal champion removed from latest email thread. Possible loss of backing.',color:'var(--warn)'},{title:'Email Opened 3×, No Reply',time:'6d ago',desc:'Renewal pricing email opened by Sarah Chen three times. Zero response.',color:'var(--danger)'},{title:'Exec Gone Dark',time:'8d ago',desc:'Sarah Chen (CFO) stopped responding to all outreach.',color:'var(--danger)'}],
    contracts:[{name:'Enterprise License 2026',type:'Annual · Auto-renew',status:'RENEWAL DUE 32d',statusColor:'var(--warn)',value:'$480K',po:'PO-2026-0142',start:'Jan 01, 2026',end:'Dec 31, 2026',invoice:'Invoice #INV-041 · Due Dec 15 · $120K'},{name:'Professional Services',type:'Quarterly · Implementation',status:'ACTIVE',statusColor:'var(--ok)',value:'$45K',po:'PO-2026-0198',start:'Oct 01, 2026',end:'Mar 31, 2027',invoice:'Invoice #INV-038 · Paid Nov 01 · $15K'}]},
  meridian:{spark:[60,58,54,50,44,40,35],name:'Meridian Labs',contact:'Alex Park · CEO',arr:'$850K',health:28,risk:'HIGH',riskClass:'rhi',arrColor:'var(--danger)',stage:'Renewal',signals:11,dark:5,rep:'Andy G',
    brief:['CEO exploring alternatives - renewal at risk with 47 days remaining','Timeline slipping from Q1 to Q2 - internal approval delays','Product usage down 18% month-over-month - onboarding gap suspected'],
    briefTypes:['danger','danger','warn'],
    sigItems:[{sev:'danger',msg:'CEO mentioned "looking at alternatives" in Slack',time:'1h',via:'Slack'},{sev:'danger',msg:'Renewal timeline pushed from Q1 to Q2',time:'6h',via:'Email'},{sev:'warn',msg:'Product usage declined 18% MoM',time:'1d',via:'HubSpot'}],
    comms:[{from:'Alex Park',role:'CEO',msg:'We need to discuss the renewal terms. Some things have changed on our end.',time:'5d ago',via:'Gmail',dir:'in',signal:'Negative',signalColor:'var(--danger)',draft:[{tone:'Empathetic',body:'Of course Alex - I\'d love to understand what\'s shifted. Can we find 30min this week to discuss?'},{tone:'Value-led',body:'Alex, I\'ve put together a renewal impact summary showing $2.1M in value delivered this year. Happy to walk through it.'}]},{from:'You',role:'',msg:'Of course Alex - I\'d love to understand what\'s shifted. Can we find 30min this week?',time:'4d ago',via:'Gmail',dir:'out'}],
    people:[{name:'Alex Park',role:'CEO',badge:'DECISION MAKER',badgeColor:'var(--danger)',status:'Cautious',statusColor:'var(--warn)',last:'5d ago',eng:38,desc:'Exploring alternatives. Needs direct executive engagement to rebuild trust.'},{name:'Dana Wu',role:'VP Product',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Neutral',statusColor:'var(--t3)',last:'10d ago',eng:42,desc:'Product usage declining. May not be advocating internally.'}],
    healthBars:[{label:'Engagement',val:28,color:'var(--danger)'},{label:'Product Fit',val:72,color:'var(--ok)'},{label:'Legal',val:60,color:'var(--warn)'},{label:'Financial',val:35,color:'var(--danger)'}],
    timeline:[{title:'CEO Exploring Alternatives',time:'1h ago',desc:'"Looking at alternatives" mentioned in internal Slack. Competitor Gong referenced.',color:'var(--danger)'},{title:'Renewal Timeline Pushed',time:'6h ago',desc:'Renewal shifted from Q1 to Q2. Internal approval delays cited.',color:'var(--danger)'},{title:'Product Usage Drop',time:'1d ago',desc:'Usage down 18% month-over-month. Onboarding gap suspected.',color:'var(--warn)'},{title:'Quarterly Business Review',time:'2w ago',desc:'QBR completed. Alex Park raised concerns about ROI visibility.',color:'var(--blue)'}],
    contracts:[{name:'Enterprise Platform License',type:'Annual · Auto-renew',status:'RENEWAL DUE 47d',statusColor:'var(--danger)',value:'$850K',po:'PO-2025-0891',start:'Apr 01, 2025',end:'Mar 31, 2026',invoice:'Invoice #INV-067 · Due Mar 15 · $212K'},{name:'Data Integration Add-on',type:'Annual',status:'ACTIVE',statusColor:'var(--ok)',value:'$95K',po:'PO-2025-0912',start:'Jul 01, 2025',end:'Jun 30, 2026',invoice:'Invoice #INV-052 · Paid Jan 01 · $47.5K'}]},
  axion:{spark:[45,42,40,42,38,35,32],name:'Axion Partners',contact:'Marcus Webb · VP Eng',arr:'$95K',health:52,risk:'MEDIUM',riskClass:'rmd',arrColor:'var(--warn)',stage:'Legal Review',signals:6,dark:1,rep:'Andy G',
    brief:['Contract redlines sent Nov 14 - waiting on legal for 3 days','Technical evaluation complete - no blockers on engineering side','PO expected within 2 weeks if legal clears this week'],
    briefTypes:['warn','ok','ok'],
    sigItems:[{sev:'warn',msg:'Legal review stalled at day 3 - no response from their team',time:'2h',via:'Email'},{sev:'ok',msg:'Marcus confirmed technical requirements met',time:'1d',via:'Zoom'}],
    comms:[{from:'Marcus Webb',role:'VP Eng',msg:'Legal is reviewing the final clauses. Should have feedback by EOW.',time:'1d ago',via:'Gmail',dir:'in',signal:'Neutral',signalColor:'var(--warn)',draft:[{tone:'Supportive',body:'Thanks Marcus. We have pre-approved redlines that typically clear in 3 days - want me to send to your legal team directly?'},{tone:'Expediting',body:'Marcus, I can send our simplified terms today to speed things up. Shall I loop in your legal contact?'}]},{from:'You',role:'',msg:'Thanks Marcus. Anything I can provide to help expedite on our side?',time:'1d ago',via:'Gmail',dir:'out'}],
    people:[{name:'Marcus Webb',role:'VP Eng',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Active',statusColor:'var(--ok)',last:'1d ago',eng:82,desc:'Driving deal forward. Waiting on legal clearance.'},{name:'Lisa Chen',role:'Legal Counsel',badge:'BLOCKER',badgeColor:'var(--danger)',status:'Slow',statusColor:'var(--warn)',last:'3d ago',eng:30,desc:'Reviewing redlines. No response in 3 days.'}],
    healthBars:[{label:'Engagement',val:72,color:'var(--ok)'},{label:'Product Fit',val:90,color:'var(--ok)'},{label:'Legal',val:35,color:'var(--danger)'},{label:'Financial',val:78,color:'var(--ok)'}],
    timeline:[{title:'Legal Review Stalled',time:'2h ago',desc:'Contract redlines sent Nov 14 - no response from legal team.',color:'var(--warn)'},{title:'Technical Eval Complete',time:'1d ago',desc:'Marcus confirmed all requirements met. Engineering ready.',color:'var(--ok)'},{title:'Contract Sent',time:'5d ago',desc:'Final contract with redlines sent to legal for review.',color:'var(--blue)'}],
    contracts:[{name:'Growth License',type:'Annual',status:'PENDING LEGAL',statusColor:'var(--warn)',value:'$95K',po:'Pending',start:'TBD',end:'TBD',invoice:'Awaiting contract execution'}]},
  techflow:{spark:[50,48,45,43,40,40,38],name:'TechFlow Inc',contact:'Lena Ford · COO',arr:'$210K',health:55,risk:'MEDIUM',riskClass:'rmd',arrColor:'var(--warn)',stage:'Discovery',signals:8,dark:3,rep:'Andy G',
    brief:['CFO mentioned "check with finance" on call - budget authority may have shifted','Multi-threaded deal: COO positive but CFO cautious','Phased pricing could unblock - 62% close rate for this pattern'],
    briefTypes:['warn','warn','ok'],
    sigItems:[{sev:'warn',msg:'CFO mentioned "need to check with finance"',time:'3h',via:'Zoom'},{sev:'warn',msg:'Budget discussion deferred to next quarter review',time:'1d',via:'Email'},{sev:'ok',msg:'COO expressed strong interest in integration capabilities',time:'2d',via:'Slack'}],
    comms:[{from:'Lena Ford',role:'COO',msg:'This looks great from our ops perspective. Let me loop in our CFO.',time:'3d ago',via:'Gmail',dir:'in',signal:'Positive',signalColor:'var(--ok)',draft:[{tone:'Strategic',body:'Great to hear, Lena! I\'ve prepared a phased pricing option that should make the CFO conversation easier. Can we get 15 min this week?'},{tone:'Proactive',body:'Thanks Lena - I\'ll send a one-page finance summary directly to James. Would that help move things along?'}]}],
    people:[{name:'Lena Ford',role:'COO',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Positive',statusColor:'var(--ok)',last:'3d ago',eng:76,desc:'Strong operational interest. Actively pushing for adoption.'},{name:'James Yeo',role:'CFO',badge:'DECISION MAKER',badgeColor:'var(--danger)',status:'Cautious',statusColor:'var(--warn)',last:'3d ago',eng:40,desc:'Budget authority. "Check with finance" indicates procurement hurdle.'}],
    healthBars:[{label:'Engagement',val:55,color:'var(--warn)'},{label:'Product Fit',val:82,color:'var(--ok)'},{label:'Legal',val:70,color:'var(--ok)'},{label:'Financial',val:32,color:'var(--danger)'}],
    timeline:[{title:'CFO Budget Concern',time:'3h ago',desc:'"Need to check with finance" on discovery call. Budget authority shifted.',color:'var(--warn)'},{title:'COO Positive Signal',time:'2d ago',desc:'Lena expressed strong interest in integration capabilities.',color:'var(--ok)'},{title:'Discovery Call',time:'3d ago',desc:'45 min call with Lena Ford. 3 use cases identified.',color:'var(--blue)'}],
    contracts:[{name:'Proposed Enterprise License',type:'Annual',status:'NEGOTIATION',statusColor:'var(--warn)',value:'$210K',po:'Pending',start:'TBD',end:'TBD',invoice:'Proposal sent · Awaiting budget approval'}]},
  techvault:{spark:[44,42,40,38,36,35,33],name:'TechVault Inc',contact:'Jamie Torres · VP Eng',arr:'$210K',health:48,risk:'MEDIUM',riskClass:'rmd',arrColor:'var(--warn)',stage:'Discovery',signals:7,dark:3,rep:'Mike Ross',
    brief:['Price sensitivity detected - asked for discount twice in last week','Technical fit confirmed but procurement process is slow'],
    briefTypes:['warn','ok'],
    sigItems:[{sev:'warn',msg:'Asked for 15% discount in follow-up email',time:'2d',via:'Gmail'},{sev:'ok',msg:'Technical POC completed successfully',time:'5d',via:'Zoom'}],
    comms:[{from:'Jamie Torres',role:'VP Eng',msg:'Can we revisit the pricing? We\'re comparing against two other vendors.',time:'3d ago',via:'Gmail',dir:'in',signal:'Negative',signalColor:'var(--danger)',draft:[{tone:'Value-led',body:'Hi Jamie - I understand the comparison. I\'ve prepared a side-by-side showing where our ROI exceeds both alternatives. Can we walk through it?'},{tone:'Flexible',body:'Jamie, happy to revisit pricing. What if we started with a smaller scope to prove value first?'}]}],
    people:[{name:'Jamie Torres',role:'VP Eng',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Active',statusColor:'var(--ok)',last:'3d ago',eng:68,desc:'Technically sold. Pushing for better pricing to justify to board.'}],
    healthBars:[{label:'Engagement',val:60,color:'var(--warn)'},{label:'Product Fit',val:85,color:'var(--ok)'},{label:'Legal',val:65,color:'var(--ok)'},{label:'Financial',val:38,color:'var(--danger)'}],
    timeline:[{title:'Price Sensitivity Flagged',time:'2d ago',desc:'Asked for 15% discount in follow-up email. Comparing vendors.',color:'var(--warn)'},{title:'Technical POC Complete',time:'5d ago',desc:'POC completed successfully. All requirements validated.',color:'var(--ok)'}],
    contracts:[{name:'Proposed Growth License',type:'Annual',status:'PRICING REVIEW',statusColor:'var(--warn)',value:'$210K',po:'Pending',start:'TBD',end:'TBD',invoice:'Pricing negotiation in progress'}]},
  nexus:{spark:[30,35,38,45,52,62,72],name:'Nexus AI',contact:'Priya Sharma · CTO',arr:'$320K',health:88,risk:'LOW',riskClass:'rlo',arrColor:'var(--ok)',stage:'Closing',signals:5,dark:0,rep:'Andy G',
    brief:['CTO forwarded proposal to legal with "let\'s fast-track"','PO expected this week - all technical approvals complete','Champion highly engaged - responding within hours'],
    briefTypes:['ok','ok','ok'],
    sigItems:[{sev:'ok',msg:'Proposal forwarded to legal for final review',time:'34m',via:'Gmail'},{sev:'ok',msg:'All technical requirements confirmed',time:'1d',via:'Slack'}],
    comms:[{from:'Priya Sharma',role:'CTO',msg:'Sent the proposal to legal. They should turn it around quickly.',time:'34m ago',via:'Gmail',dir:'in',signal:'Positive',signalColor:'var(--ok)',draft:[{tone:'Grateful',body:'Fantastic news Priya - thank you for driving this forward. Let me know if legal needs anything from our side.'},{tone:'Momentum',body:'Great to hear! I\'ll have our implementation team on standby so we can hit the ground running once the PO comes through.'}]}],
    people:[{name:'Priya Sharma',role:'CTO',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Champion',statusColor:'var(--ok)',last:'34m ago',eng:95,desc:'Highly engaged. Forwarding proposals to legal. Driving fast-track.'},{name:'Tom Nguyen',role:'Head Eng',badge:'INFLUENCER',badgeColor:'var(--blue)',status:'Active',statusColor:'var(--ok)',last:'1d ago',eng:88,desc:'Technical requirements confirmed. Integration team standing by.'}],
    healthBars:[{label:'Engagement',val:95,color:'var(--ok)'},{label:'Product Fit',val:92,color:'var(--ok)'},{label:'Legal',val:80,color:'var(--ok)'},{label:'Financial',val:88,color:'var(--ok)'}],
    timeline:[{title:'Proposal to Legal',time:'34m ago',desc:'CTO forwarded proposal with note "let\'s fast-track this".',color:'var(--ok)'},{title:'Technical Approval',time:'1d ago',desc:'All technical requirements confirmed. Integration specs signed off.',color:'var(--ok)'},{title:'Executive Presentation',time:'3d ago',desc:'Final presentation to leadership team. Unanimous positive feedback.',color:'var(--ok)'}],
    contracts:[{name:'Enterprise License',type:'Annual',status:'PO EXPECTED',statusColor:'var(--ok)',value:'$320K',po:'Pending this week',start:'Jan 01, 2026',end:'Dec 31, 2026',invoice:'Awaiting PO generation'}]},
  cobalt:{spark:[50,55,60,68,74,80,88],name:'Cobalt Systems',contact:'Dana Kim · CRO',arr:'$150K',health:82,risk:'LOW',riskClass:'rlo',arrColor:'var(--ok)',stage:'Closed Won',signals:2,dark:0,rep:'Jamie T',
    brief:['Deal closed-won today - $150K ARR','Onboarding kickoff scheduled for next Monday'],
    briefTypes:['ok','ok'],
    sigItems:[{sev:'ok',msg:'Contract signed - deal closed-won',time:'2h',via:'HubSpot'}],
    comms:[{from:'Dana Kim',role:'CRO',msg:'Contract is signed! Looking forward to getting started.',time:'2h ago',via:'Gmail',dir:'in',signal:'Positive',signalColor:'var(--ok)',draft:[{tone:'Celebratory',body:'Thrilled to have you on board, Dana! Onboarding kickoff is Monday - I\'ll send the agenda shortly.'}]}],
    people:[{name:'Dana Kim',role:'CRO',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Champion',statusColor:'var(--ok)',last:'2h ago',eng:92,desc:'Contract signed today. Excited about onboarding.'}],
    healthBars:[{label:'Engagement',val:92,color:'var(--ok)'},{label:'Product Fit',val:88,color:'var(--ok)'},{label:'Legal',val:100,color:'var(--ok)'},{label:'Financial',val:95,color:'var(--ok)'}],
    timeline:[{title:'Deal Closed-Won',time:'2h ago',desc:'Contract signed - $150K ARR. Onboarding kickoff Monday.',color:'var(--ok)'},{title:'Final Negotiation',time:'1d ago',desc:'Last pricing adjustment agreed. Dana confirmed approval.',color:'var(--ok)'}],
    contracts:[{name:'Enterprise License 2026',type:'Annual',status:'SIGNED ✓',statusColor:'var(--ok)',value:'$150K',po:'PO-2026-0288',start:'Jan 15, 2026',end:'Jan 14, 2027',invoice:'Invoice #INV-072 · Due Feb 15 · $150K'}]},
  brightwave:{name:'Brightwave',contact:'Chris Lee · RevOps',arr:'$180K',health:76,risk:'LOW',riskClass:'rlo',arrColor:'var(--ok)',stage:'Re-engaged',signals:3,dark:0,rep:'Andy G',
    brief:['Re-engaged after 14-day silence - ready to move forward','Onboarding interest confirmed'],
    briefTypes:['ok','ok'],
    sigItems:[{sev:'ok',msg:'Replied after 14d silence: "ready to move forward"',time:'5h',via:'WhatsApp'}],
    comms:[{from:'Chris Lee',role:'RevOps',msg:'Sorry for the delay - we\'re ready to move forward with onboarding.',time:'5h ago',via:'WhatsApp',dir:'in',signal:'Positive',signalColor:'var(--ok)',draft:[{tone:'Warm',body:'No worries at all, Chris! Great to have you back. I\'ll send the onboarding schedule today.'},{tone:'Action-oriented',body:'Welcome back Chris! Kickoff is scheduled for Monday. I\'ll send calendar invites to your team now.'}]}],
    people:[{name:'Chris Lee',role:'RevOps',badge:'CHAMPION',badgeColor:'var(--ok)',status:'Active',statusColor:'var(--ok)',last:'5h ago',eng:72,desc:'Re-engaged after 14-day silence. Ready for onboarding.'}],
    healthBars:[{label:'Engagement',val:72,color:'var(--ok)'},{label:'Product Fit',val:78,color:'var(--ok)'},{label:'Legal',val:85,color:'var(--ok)'},{label:'Financial',val:70,color:'var(--ok)'}],
    timeline:[{title:'Re-engaged',time:'5h ago',desc:'"Sorry for the delay - ready to move forward with onboarding."',color:'var(--ok)'},{title:'Silence Period',time:'14d ago',desc:'No response to 3 follow-up attempts over 14 days.',color:'var(--danger)'},{title:'Initial Interest',time:'3w ago',desc:'Inbound demo request. Strong interest in revenue signal detection.',color:'var(--blue)'}],
    contracts:[{name:'Growth License',type:'Annual',status:'ONBOARDING',statusColor:'var(--ok)',value:'$180K',po:'PO-2026-0301',start:'Feb 01, 2026',end:'Jan 31, 2027',invoice:'Invoice #INV-075 · Due Mar 01 · $45K (Q1)'}]},
  vertex:{spark:[48,46,44,42,40,38,36],name:'Vertex Systems',contact:'Dana Kim · CRO',arr:'$140K',health:65,risk:'MONITOR',riskClass:'rmd',arrColor:'var(--blue)',stage:'Proposal',signals:4,dark:2,rep:'Mike Ross',
    brief:['Proposal under review - awaiting feedback from procurement','Technical eval scored 8/10 - minor integration concern noted'],
    briefTypes:['ok','warn'],
    sigItems:[{sev:'ok',msg:'Proposal delivered and confirmed received',time:'2d',via:'Gmail'},{sev:'warn',msg:'Procurement flagged timeline question',time:'1d',via:'Email'}],
    comms:[{from:'Dana Kim',role:'CRO',msg:'Proposal received. Procurement will review this week.',time:'2d ago',via:'Gmail',dir:'in',signal:'Neutral',signalColor:'var(--warn)',draft:[{tone:'Helpful',body:'Thanks Dana. I\'m available if procurement has any questions - happy to join a call with them directly.'},{tone:'Proactive',body:'Great, Dana. I\'ve attached a quick FAQ that typically speeds up procurement review. Let me know if anything else helps.'}]}],
    people:[{name:'Dana Kim',role:'CRO',badge:'DECISION MAKER',badgeColor:'var(--blue)',status:'Active',statusColor:'var(--ok)',last:'2d ago',eng:65,desc:'Proposal received. Coordinating with procurement.'},{name:'Chris Lee',role:'RevOps',badge:'INFLUENCER',badgeColor:'var(--blue)',status:'Neutral',statusColor:'var(--t3)',last:'5d ago',eng:50,desc:'Technical evaluation complete. Waiting on procurement.'}],
    healthBars:[{label:'Engagement',val:65,color:'var(--ok)'},{label:'Product Fit',val:80,color:'var(--ok)'},{label:'Legal',val:55,color:'var(--warn)'},{label:'Financial',val:60,color:'var(--warn)'}],
    timeline:[{title:'Proposal Delivered',time:'2d ago',desc:'Full proposal sent and confirmed received by Dana Kim.',color:'var(--ok)'},{title:'Procurement Flag',time:'1d ago',desc:'Procurement flagged timeline question. May need clarification.',color:'var(--warn)'},{title:'Technical Eval',time:'1w ago',desc:'Scored 8/10. Minor integration concern noted, addressed.',color:'var(--blue)'}],
    contracts:[{name:'Proposed Enterprise License',type:'Annual',status:'UNDER REVIEW',statusColor:'var(--blue)',value:'$140K',po:'Pending',start:'TBD',end:'TBD',invoice:'Proposal in procurement review'}]}
};

// Build the A360 panel payload for a given demo account id.
export function buildA360(id: string) {
  const a = DEMO_ACCOUNTS[id]
  if (!a) return null
  const dark = a.dark
  const lastTouch = dark > 0
    ? `Last exec touch: ${dark} day${dark === 1 ? '' : 's'} ago`
    : 'Last touch: today'
  return {
    id,
    name: a.name,
    contact: a.contact,
    stage: a.stage,
    arr: a.arr,
    health: a.health,
    signals: a.signals,
    daysDark: a.dark,
    risk: a.risk,
    rep: a.rep,
    lastTouch,
    brief: a.brief,
    briefTypes: a.briefTypes as ('danger' | 'warn' | 'ok')[] | undefined,
    healthBars: a.healthBars,
    sigItems: a.sigItems as { sev: 'danger' | 'warn' | 'ok'; msg: string; time: string; via: string }[] | undefined,
    comms: a.comms as { from: string; role: string; msg: string; time: string; via: string; dir: 'in' | 'out'; signal?: string; signalColor?: string }[] | undefined,
    people: a.people,
    timeline: a.timeline,
    contracts: a.contracts,
  }
}
