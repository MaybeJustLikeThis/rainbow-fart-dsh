import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceCombo, initialCombo } from '../core.js'
import { DEFAULT_SETTINGS, normalizeSettings, shouldTriggerEgg } from '../customization.js'

test('settings reject unsafe values and bound user-controlled thresholds', () => {
  const settings = normalizeSettings({
    theme: 'unknown', panelPlacement: 'floating', accent: 'red;url(x)', volume: 4,
    eggMinCombo: 100, eggMinTurnPoints: -5, eggCooldownMin: 0,
    eggMessage: '<img onerror=alert(1)>', customMascot: 'data:image/svg+xml;base64,abc',
  })
  assert.equal(settings.theme, DEFAULT_SETTINGS.theme)
  assert.equal(settings.panelPlacement, 'left')
  assert.equal(normalizeSettings({ panelPlacement: 'bottom' }).panelPlacement, 'bottom')
  assert.equal(settings.accent, DEFAULT_SETTINGS.accent)
  assert.equal(settings.volume, 1)
  assert.equal(settings.eggMinCombo, 30)
  assert.equal(settings.eggMinTurnPoints, 40)
  assert.equal(settings.eggCooldownMin, 1)
  assert.equal(settings.customMascot, '')
  assert.equal(settings.eggMessage, '<img onerror=alert(1)>') // React renders this as text.
})

test('Easter egg requires a rare clean turn and respects cooldown', () => {
  const settings = normalizeSettings()
  const good = { completed: true, failed: false, combo: 8, turnPoints: 200, now: 1_000_000, lastEggAt: 0 }
  assert.equal(shouldTriggerEgg(good, settings), true)
  assert.equal(shouldTriggerEgg({ ...good, combo: 7 }, settings), false)
  assert.equal(shouldTriggerEgg({ ...good, turnPoints: 199 }, settings), false)
  assert.equal(shouldTriggerEgg({ ...good, failed: true }, settings), false)
  assert.equal(shouldTriggerEgg({ ...good, lastEggAt: 900_000 }, settings), false)
})

test('Jev gate is optional and requires a strong breakthrough only when enabled', () => {
  const settings = normalizeSettings({ eggRequiresJev: true })
  const event = { completed: true, failed: false, combo: 8, turnPoints: 200, now: 1_000_000, lastEggAt: 0 }
  assert.equal(shouldTriggerEgg(event, settings), false)
  assert.equal(shouldTriggerEgg({ ...event, jevChoice: 'steady', probability: 0.9 }, settings), false)
  assert.equal(shouldTriggerEgg({ ...event, jevChoice: 'breakthrough', probability: 0.74 }, settings), false)
  assert.equal(shouldTriggerEgg({ ...event, jevChoice: 'breakthrough', probability: 0.75 }, settings), true)
})

test('a long final response keeps the peak combo eligible for the Easter egg', () => {
  let state = advanceCombo(initialCombo(), { seq: 1, kind: 'start' }, 1_000).state
  for (let seq = 2; seq <= 21; seq++) {
    state = advanceCombo(state, { seq, kind: 'tool' }, 1_000 + seq * 100).state
  }
  assert.equal(state.turnPoints, 670)
  assert.equal(state.turnMaxCombo, 20)
  state = advanceCombo(state, { seq: 22, kind: 'complete' }, 100_000).state
  assert.equal(state.count, 1)
  assert.equal(state.turnMaxCombo, 20)
  assert.equal(shouldTriggerEgg({
    completed: true, failed: state.hadFailure, combo: state.turnMaxCombo,
    turnPoints: state.turnPoints, now: 1_000_000, lastEggAt: 0,
  }, DEFAULT_SETTINGS), true)
  state = advanceCombo(state, { seq: 23, kind: 'start' }, 100_100).state
  assert.equal(state.turnMaxCombo, 0)
})
