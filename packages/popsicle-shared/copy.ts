// The product's own words, and the spelling pairs. American English is the default; a person can
// choose British in Settings and every string below follows, in both apps.

export type Spelling = 'US' | 'UK'

const PAIRS: Array<[string, string]> = [
  ['summarize', 'summarise'], ['Summarize', 'Summarise'],
  ['summarized', 'summarised'], ['Summarized', 'Summarised'],
  ['summarizing', 'summarising'],
  ['prioritize', 'prioritise'], ['Prioritize', 'Prioritise'], ['prioritized', 'prioritised'],
  ['organization', 'organisation'], ['Organization', 'Organisation'],
  ['personalize', 'personalise'], ['Personalize', 'Personalise'],
  ['canceled', 'cancelled'], ['Canceled', 'Cancelled'], ['canceling', 'cancelling'],
  ['color', 'colour'], ['Color', 'Colour'], ['colors', 'colours'],
  ['behavior', 'behaviour'], ['Behavior', 'Behaviour'],
  ['center', 'centre'], ['Center', 'Centre'],
  ['analyze', 'analyse'], ['Analyze', 'Analyse'], ['analyzed', 'analysed'], ['analyzing', 'analysing'],
  ['recognize', 'recognise'], ['Recognize', 'Recognise'],
  ['apologize', 'apologise'], ['Apologize', 'Apologise'],
  ['favorite', 'favourite'], ['Favorite', 'Favourite'],
  ['neighboring', 'neighbouring'],
  ['traveled', 'travelled'], ['modeling', 'modelling'],
]

/** Rewrite US text into the chosen spelling. */
export function spell(text: string, mode: Spelling): string {
  if (mode === 'US') return text
  let out = text
  for (const [us, uk] of PAIRS) out = out.split(us).join(uk)
  return out
}

export const LANGUAGES: Array<{ label: string; spelling: Spelling }> = [
  { label: 'English (US)', spelling: 'US' },
  { label: 'English (UK)', spelling: 'UK' },
]

export function spellingFor(language: string | null | undefined): Spelling {
  return String(language ?? '').includes('UK') ? 'UK' : 'US'
}

/** The atom. Capitalized wherever a person reads it; the database table stays `signals`. */
export const CONCERN = { one: 'Concern', many: 'Concerns', engine: 'Concern engine' } as const
