import test from 'node:test'
import assert from 'node:assert/strict'
import { addBreakdown, advanceCombo, candidateFromEvent, classifyActivity, createActivityTracker, initialBreakdown, initialCombo, latestDurableSeq, newDurableEntries, observeActivity, ratingForTurn, reconcileBreakdown, scoreFor, summarizeBreakdown } from '../core.js'

test('successes build a combo, failures break it, and repeated events do not score twice', () => {
  let state = initialCombo()
  for (let seq = 1; seq <= 3; seq++) {
    const result = advanceCombo(state, { seq, kind: 'tool' }, seq * 1000)
    state = result.state
    if (seq === 3) assert.deepEqual([result.show, result.tier, state.count], [true, 'combo', 3])
  }
  state = advanceCombo(state, { seq: 3, kind: 'tool' }, 3100).state
  assert.equal(state.count, 3)
  assert.equal(state.points, 40)
  state = advanceCombo(state, { seq: 4, kind: 'failure' }, 4000).state
  assert.equal(state.count, 0)
  assert.equal(state.points, 40)
  state = advanceCombo(state, { seq: 5, kind: 'tool' }, 5000).state
  assert.equal(state.count, 1)
  assert.equal(state.points, 50)
})

test('expired streaks restart; summaries cannot inflate a combo', () => {
  let state = advanceCombo(initialCombo(), { seq: 1, kind: 'tool' }, 1000).state
  state = advanceCombo(state, { seq: 2, kind: 'summary' }, 2000).state
  assert.equal(state.count, 1)
  state = advanceCombo(state, { seq: 3, kind: 'complete' }, 100_000).state
  assert.equal(state.count, 1)
})

test('tool errors and assistant text derive from durable event shape', () => {
  assert.equal(candidateFromEvent({ seq: 1, type: 'tool/result', data: { error: { name: 'x' } } }).kind, 'failure')
  assert.equal(candidateFromEvent({ seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Fixed the bug.' }] } } }).text, 'Fixed the bug.')
})

test('a failed step cannot become an automatic celebration at turn end', () => {
  let state = advanceCombo(initialCombo(), { seq: 1, kind: 'failure' }, 1000).state
  const completed = advanceCombo(state, { seq: 2, kind: 'complete' }, 2000)
  assert.equal(completed.show, false)
  assert.equal(completed.state.count, 0)
})

test('points use the new streak tier and completion base; cooldown cannot suppress scoring', () => {
  let state = initialCombo()
  const gains = []
  for (let seq = 1; seq <= 9; seq++) {
    const result = advanceCombo(state, { seq, kind: seq === 9 ? 'complete' : 'tool' }, seq * 100)
    gains.push(result.earned)
    state = result.state
  }
  assert.deepEqual(gains, [10, 10, 20, 20, 30, 30, 30, 40, 80])
  assert.equal(state.points, 270)
  assert.equal(scoreFor('summary', 8), 0)
  assert.equal(advanceCombo(state, { seq: 9, kind: 'complete' }, 1000).earned, 0)
})

test('score breakdown groups actual combo-adjusted gains and keeps older points separate', () => {
  let state = initialCombo(5210)
  let breakdown = initialBreakdown(state.points)
  const names = ['base', 'web_search', 'base', 'web_search', 'web_search']
  for (let index = 0; index < names.length; index++) {
    const result = advanceCombo(state, { seq: index + 1, kind: 'tool' }, (index + 1) * 1000)
    state = result.state
    breakdown = addBreakdown(breakdown, 'tool', names[index], result.earned)
  }
  const completed = advanceCombo(state, { seq: 6, kind: 'complete' }, 6000)
  state = completed.state
  breakdown = addBreakdown(breakdown, 'complete', '', completed.earned)
  assert.deepEqual(breakdown, { previousPoints: 5210, rows: [
    { kind: 'tool', name: 'base', count: 2, points: 30 },
    { kind: 'tool', name: 'web_search', count: 3, points: 60 },
    { kind: 'complete', name: 'complete', count: 1, points: 60 },
  ] })
  assert.equal(state.points, 5360)
  assert.deepEqual(reconcileBreakdown(JSON.parse(JSON.stringify(breakdown)), state.points), breakdown)
  assert.deepEqual(reconcileBreakdown(breakdown, state.points + 10), initialBreakdown(state.points + 10))
})

test('ordinary and PTC tool calls use the underlying tool name without double scoring run_code', () => {
  const tracker = createActivityTracker()
  const events = [
    { seq: 1, type: 'tool/call', data: { callId: 'direct', name: 'web_search' } },
    { seq: 2, type: 'tool/result', data: { message: { source: { callId: 'direct' }, content: [{ type: 'tool-result', isError: false }] } } },
    { seq: 3, type: 'tool/call', data: { callId: 'outer', name: 'run_code' } },
    { seq: 4, type: 'tool/ptc-dispatch', data: { rootCallId: 'outer', subCallId: 'sub1', name: 'skill', isError: false } },
    { seq: 5, type: 'tool/ptc-dispatch', data: { rootCallId: 'outer', subCallId: 'sub2', name: 'web_search', isError: false } },
    { seq: 6, type: 'tool/result', data: { message: { source: { callId: 'outer' }, content: [{ type: 'tool-result', isError: false }] } } },
  ]
  const scored = events.map(event => observeActivity(tracker, event)).filter(Boolean)
  assert.deepEqual(scored.map(item => [item.candidate.kind, item.name]), [
    ['tool', 'web_search'], ['tool', 'skill'], ['tool', 'web_search'],
  ])
  assert.equal(observeActivity(tracker, { seq: 7, type: 'tool/call', data: { callId: 'empty', name: 'run_code' } }), null)
  assert.equal(observeActivity(tracker, { seq: 8, type: 'tool/result', data: { message: { source: { callId: 'empty' }, content: [] } } }).candidate.kind, 'tool')
  const replayed = createActivityTracker(events.slice(0, 5).map(event => ({ type: 'event', event })))
  assert.equal(observeActivity(replayed, events[5]), null)
})

test('PTC failures break combos and category summaries preserve exact earned points', () => {
  const tracker = createActivityTracker()
  observeActivity(tracker, { seq: 1, type: 'tool/call', data: { callId: 'outer', name: 'run_code' } })
  const failure = observeActivity(tracker, { seq: 2, type: 'tool/ptc-dispatch', data: { rootCallId: 'outer', name: 'skill', isError: true } })
  assert.equal(failure.candidate.kind, 'failure')
  assert.equal(observeActivity(tracker, { seq: 3, type: 'tool/result', data: { message: { source: { callId: 'outer' }, content: [] } } }), null)
  const duplicate = createActivityTracker()
  observeActivity(duplicate, { seq: 4, type: 'tool/call', data: { callId: 'failed', name: 'run_code' } })
  observeActivity(duplicate, { seq: 5, type: 'tool/ptc-dispatch', data: { rootCallId: 'failed', name: 'web_search', isError: true } })
  assert.equal(observeActivity(duplicate, { seq: 6, type: 'tool/result', data: { message: { source: { callId: 'failed' }, content: [{ type: 'tool-result', isError: true }] } } }), null)
  assert.equal(classifyActivity('tool', 'mcp__web__web_search'), 'web')
  assert.equal(classifyActivity('tool', 'skill'), 'skill')
  assert.equal(classifyActivity('tool', 'todo_write'), 'other')
  let breakdown = initialBreakdown(90)
  for (const [kind, name, points] of [
    ['tool', 'web_search', 20], ['tool', 'web_fetch', 10], ['tool', 'skill', 40],
    ['tool', 'read', 10], ['tool', 'todo_write', 10], ['complete', '', 60],
  ]) breakdown = addBreakdown(breakdown, kind, name, points)
  const summary = summarizeBreakdown(breakdown)
  assert.deepEqual(summary.map(row => [row.category, row.count, row.points]), [
    ['complete', 1, 60], ['skill', 1, 40], ['web', 2, 30], ['files', 1, 10], ['other', 1, 10],
  ])
  assert.equal(summary.reduce((sum, row) => sum + row.points, breakdown.previousPoints), 240)
})

test('a turn with a recovered tool failure still gets no completion points', () => {
  let state = initialCombo(120)
  state = advanceCombo(state, { seq: 1, kind: 'start' }, 100).state
  state = advanceCombo(state, { seq: 2, kind: 'failure' }, 200).state
  state = advanceCombo(state, { seq: 3, kind: 'tool' }, 300).state
  const complete = advanceCombo(state, { seq: 4, kind: 'complete' }, 400)
  assert.equal(complete.earned, 0)
  assert.equal(complete.state.points, 130)
  state = advanceCombo(complete.state, { seq: 5, kind: 'start' }, 500).state
  assert.equal(advanceCombo(state, { seq: 6, kind: 'complete' }, 600).earned, 20)
})

test('turn ratings use this turn only and cover playful tiers', () => {
  const rate = points => ratingForTurn({ points, completed: true }).key
  assert.deepEqual([0, 10, 30, 80, 160, 280].map(rate),
    ['ready', 'firstStep', 'warming', 'craft', 'masterpiece', 'astonishing'])
  assert.equal(ratingForTurn({ points: 280, completed: false }).key, 'recover')
  assert.equal(ratingForTurn({ points: 280, completed: true, failed: true }).key, 'recover')
})

test('Jev can moderate or promote a rating without changing earned points', () => {
  assert.equal(ratingForTurn({ points: 160, completed: true, jevChoice: 'none' }).key, 'firstStep')
  assert.equal(ratingForTurn({ points: 160, completed: true, jevChoice: 'steady' }).key, 'warming')
  assert.equal(ratingForTurn({ points: 80, completed: true, jevChoice: 'breakthrough', probability: 0.7 }).key, 'masterpiece')
  assert.equal(ratingForTurn({ points: 80, completed: true, jevChoice: 'breakthrough', probability: 0.5 }).key, 'craft')
  let state = initialCombo(500)
  state = advanceCombo(state, { seq: 1, kind: 'start' }, 100).state
  state = advanceCombo(state, { seq: 2, kind: 'tool' }, 200).state
  assert.equal(state.turnPoints, 10)
  assert.equal(state.points, 510)
  state = advanceCombo(state, { seq: 3, kind: 'start' }, 300).state
  assert.equal(state.turnPoints, 0)
  assert.equal(state.points, 510)
})

test('assistant settlement is observed once and a revision gap recovers unseen events', () => {
  const old = { type: 'event', event: { seq: 1, type: 'turn/start' } }
  const settled = { type: 'event', event: { seq: 2, type: 'assistant/message' } }
  const end = { type: 'event', event: { seq: 3, type: 'turn/end' } }
  assert.equal(latestDurableSeq([old]), 1)
  assert.deepEqual(newDurableEntries({ revision: 2, change: { kind: 'settle-assistant', entry: settled }, entries: [old, settled] }, 1, 1), [settled])
  assert.deepEqual(newDurableEntries({ revision: 4, change: { kind: 'append', entries: [end] }, entries: [old, settled, end] }, 1, 1), [settled, end])
})
