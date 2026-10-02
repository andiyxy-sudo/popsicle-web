// What each source reads, what Popsicle never does with it, who can see it, and how to stop it.
// Shown BEFORE anyone authorizes, because that is when the question is actually being asked.
// The "reads" lines match the scopes the server requests; where a scope is read-only, say so.

export type Trust = {
  reads: string[]
  never: string[]
  catches: string[]
}

// true of every source, whatever it is
const NEVER_ANY = [
  'Write, edit or delete anything in your account',
  'Sell your data, share it, or train anyone else’s model on it',
]

export const TRUST: Record<string, Trust> = {
  gmail: {
    reads: ['Threads with people at your accounts, and your replies to them', 'Subject, sender, timestamps and the message text'],
    never: ['Send anything without you pressing send', 'Read mail outside your accounts, or anything in Spam, Trash or Promotions', ...NEVER_ANY],
    catches: ['Silence after a thread was active', 'Pricing pushback and budget language', 'A champion going quiet or leaving'],
  },
  gcal: {
    reads: ['Meeting titles, times and who was invited', 'Whether a meeting was moved, declined or canceled'],
    never: ['Create, move or cancel an event', ...NEVER_ANY],
    catches: ['A meeting that keeps moving', 'Declines from the person who decides', 'A gap where a regular call used to be'],
  },
  slack: {
    reads: ['Channels you add, including shared channels with customers', 'Message text, who posted and when'],
    never: ['Read direct messages, or any channel you have not added', 'Post anything without you asking', ...NEVER_ANY],
    catches: ['A rival vendor named in a shared channel', 'Questions that stop getting answers', 'Scope and timeline wobble'],
  },
  hubspot: {
    reads: ['Deal names, values, stages, owners and close dates', 'Contacts and companies attached to those deals'],
    never: ['Change a deal, a stage or any field', ...NEVER_ANY],
    catches: ['A deal sliding backwards through stages', 'A close date that keeps moving', 'Value changing without a reason'],
  },
  zoom: {
    reads: ['Transcripts of calls you recorded', 'Who spoke, for how long, and when'],
    never: ['Join a call, or start a recording', ...NEVER_ANY],
    catches: ['Tone turning in the room', 'Objections raised and left unanswered', 'Buying language worth moving on'],
  },
  fireflies: {
    reads: ['Transcripts your notetaker already captured'],
    never: ['Join a meeting, or record one itself', ...NEVER_ANY],
    catches: ['Commitments made on a call', 'Competitor mentions', 'A decision maker who stopped attending'],
  },
}

/** A sensible description for a source with no entry of its own yet. */
export const TRUST_FALLBACK: Trust = {
  reads: ['Only what is needed to spot a Concern at your accounts'],
  never: NEVER_ANY,
  catches: ['Silence, slippage and the language that comes before a deal stalls'],
}

export function trustFor(key: string): Trust { return TRUST[key] ?? TRUST_FALLBACK }

/** Who can see what this source brings in, and how a person stops it. The same for every source. */
export const WHO_SEES = 'Everyone in your workspace sees the Concerns it raises, the same as any other source. The underlying messages stay yours.'
export const YOUR_CONTROL = 'Disconnect at any time and Popsicle stops reading immediately. Concerns already raised stay, and the access token is revoked at the provider.'
