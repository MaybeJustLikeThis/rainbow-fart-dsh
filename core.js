/** Pure event and combo policy. No model, DOM, storage or sound dependencies. */

export const DEFAULTS = Object.freeze({ windowMs: 90_000, cooldownMs: 3_500, maxCombo: 99 })

export function latestDurableSeq(entries, baseline = -1) {
  let seq = baseline
  for (const entry of entries) {
    if (entry.type === 'event') seq = Math.max(seq, entry.event.seq)
  }
  return seq
}

/** Use the hot-path delta; recover from batched revisions by reading only unseen durable seqs. */
export function newDurableEntries(snapshot, previousRevision, seenSeq) {
  if (snapshot.change.kind === 'replace' || snapshot.change.kind === 'prepend') return []
  if (snapshot.revision === previousRevision + 1) {
    if (snapshot.change.kind === 'append') return snapshot.change.entries
    return snapshot.change.kind === 'settle-assistant' && snapshot.change.entry ? [snapshot.change.entry] : []
  }
  return snapshot.entries.filter(entry => entry.type === 'event' && entry.event.seq > seenSeq)
}

export function initialCombo(points = 0) {
  return { count: 0, lastSuccessAt: 0, lastShownAt: 0, seenSeq: -1, hadFailure: false, points, turnPoints: 0, turnMaxCombo: 0 }
}

export function scoreFor(kind, count) {
  const base = kind === 'tool' ? 10 : kind === 'complete' ? 20 : 0
  const multiplier = count >= 8 ? 4 : count >= 5 ? 3 : count >= 3 ? 2 : 1
  return base * multiplier
}

/** Keep an auditable, bounded summary of scores observed after breakdown tracking began. */
export function initialBreakdown(previousPoints = 0) {
  return { previousPoints, rows: [] }
}

export function reconcileBreakdown(value, currentPoints) {
  if (!value || !Number.isSafeInteger(value.previousPoints) || value.previousPoints < 0 || !Array.isArray(value.rows) || value.rows.length > 21) return initialBreakdown(currentPoints)
  let total = value.previousPoints
  for (const row of value.rows) {
    if (!row || !['tool', 'complete'].includes(row.kind) || typeof row.name !== 'string' || row.name.length > 64
      || !Number.isSafeInteger(row.count) || row.count < 1 || !Number.isSafeInteger(row.points) || row.points < 1) return initialBreakdown(currentPoints)
    total += row.points
  }
  return total === currentPoints ? value : initialBreakdown(currentPoints)
}

export function addBreakdown(breakdown, kind, name, earned) {
  if (earned <= 0) return breakdown
  const label = kind === 'complete' ? 'complete' : (typeof name === 'string' && name.trim() ? name.trim().replace(/\s+/g, ' ').slice(0, 64) : 'unknown')
  const rows = breakdown.rows.map(row => ({ ...row }))
  let row = rows.find(item => item.kind === kind && item.name === label)
  const groupOtherTools = kind === 'tool' && rows.filter(item => item.kind === 'tool').length >= 19
  if (!row && groupOtherTools) row = rows.find(item => item.kind === 'tool' && item.name === 'other')
  if (!row) {
    row = { kind, name: groupOtherTools ? 'other' : label, count: 0, points: 0 }
    rows.push(row)
  }
  row.count += 1
  row.points += earned
  return { previousPoints: breakdown.previousPoints, rows }
}

const RATINGS = ['ready', 'firstStep', 'warming', 'craft', 'masterpiece', 'astonishing']

/** A playful appraisal of this turn's activity, with optional semantic moderation. */
export function ratingForTurn({ points, completed, failed = false, jevChoice, probability = 0 }) {
  if (!completed || failed) return { key: 'recover', tier: 'spark' }
  let level = points >= 280 ? 5 : points >= 160 ? 4 : points >= 80 ? 3 : points >= 30 ? 2 : points > 0 ? 1 : 0
  if (jevChoice === 'none') level = Math.min(level, 1)
  else if (jevChoice === 'steady') level = Math.min(level, 2)
  else if (jevChoice === 'breakthrough' && probability >= 0.6 && level > 0) level = Math.min(level + 1, 5)
  return { key: RATINGS[level], tier: level >= 5 ? 'legendary' : level >= 3 ? 'super' : level >= 2 ? 'combo' : 'spark' }
}

/** Turn one new durable DSH event into a candidate; historical and duplicate seqs are ignored. */
export function candidateFromEvent(event) {
  if (!event || typeof event.seq !== 'number') return null
  if (event.type === 'turn/start') return { seq: event.seq, kind: 'start', text: '' }
  if (event.type === 'tool/result') {
    const failed = event.data?.error != null || event.data?.message?.content?.some?.(
      item => item?.type === 'tool-result' && item.isError === true,
    ) === true
    return { seq: event.seq, kind: failed ? 'failure' : 'tool', text: '' }
  }
  if (event.type === 'turn/end') {
    const reason = event.data?.reason?.kind
    return { seq: event.seq, kind: reason === 'completed' ? 'complete' : 'failure', text: '' }
  }
  if (event.type === 'assistant/message') {
    const content = event.data?.message?.content
    const text = Array.isArray(content)
      ? content.filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text).join(' ')
      : ''
    return text.trim() ? { seq: event.seq, kind: 'summary', text: text.trim().slice(0, 500) } : null
  }
  return null
}

/** Deterministic streaks and cooldown. Failures reset; a summary does not add a point. */
export function advanceCombo(state, candidate, now, options = DEFAULTS) {
  if (candidate.seq <= state.seenSeq) return { state, show: false, tier: 'none', earned: 0 }
  const next = { ...state, seenSeq: candidate.seq }
  if (candidate.kind === 'start') {
    next.hadFailure = false
    next.turnPoints = 0
    next.turnMaxCombo = 0
    return { state: next, show: false, tier: 'none', earned: 0 }
  }
  if (candidate.kind === 'failure') {
    next.count = 0
    next.lastSuccessAt = 0
    next.hadFailure = true
    return { state: next, show: false, tier: 'none', earned: 0 }
  }
  if (candidate.kind === 'summary') return { state: next, show: false, tier: 'none', earned: 0 }
  if (candidate.kind === 'complete' && state.hadFailure) return { state: next, show: false, tier: 'none', earned: 0 }
  next.count = now - state.lastSuccessAt <= options.windowMs
    ? Math.min(options.maxCombo, state.count + 1) : 1
  next.turnMaxCombo = Math.max(next.turnMaxCombo ?? 0, next.count)
  next.lastSuccessAt = now
  const earned = scoreFor(candidate.kind, next.count)
  next.points += earned
  next.turnPoints += earned
  const tier = next.count >= 8 ? 'legendary' : next.count >= 5 ? 'super' : next.count >= 3 ? 'combo' : 'spark'
  const milestone = next.count === 3 || next.count === 5 || next.count === 8 || next.count % 10 === 0
  const show = milestone || now - state.lastShownAt >= options.cooldownMs
  if (show) next.lastShownAt = now
  return { state: next, show, tier, earned }
}

export function phraseFor(kind, tier, count, language = 'zh') {
  if (language === 'en') {
    if (kind === 'complete') return count >= 5 ? 'You shipped that beautifully.' : 'That turn landed. Nice work.'
    return tier === 'legendary' ? 'Unstoppable rhythm!' : tier === 'super' ? 'What a streak!' : tier === 'combo' ? 'Combo! Keep it flowing.' : 'Nice move. Keep going.'
  }
  if (kind === 'complete') return count >= 5 ? '这一轮收得漂亮，手感拉满。' : '这一轮稳稳落地，做得好。'
  return tier === 'legendary' ? '神级连击！状态挡不住了。' : tier === 'super' ? '这波连击太丝滑了！' : tier === 'combo' ? 'Combo！节奏起来了。' : '漂亮的一步，继续保持。'
}
