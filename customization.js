/** Browser preferences and the deliberately rare Easter-egg gate. */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'ocean', accent: '#38bdf8', panelOpacity: 0.94, panelPlacement: 'left',
  motion: 'full', toastAnimation: 'pop', toastPosition: 'top',
  soundEnabled: false, soundPack: 'chime', volume: 0.45, customSound: '',
  jevEnabled: false,
  eggEnabled: true, eggStyle: 'both', eggMinCombo: 8, eggMinTurnPoints: 200,
  eggCooldownMin: 10, eggRequiresJev: false, eggDurationSec: 5,
  eggBursts: 3, eggMessage: '今天的你，闪闪发光！', mascotSize: 180, customMascot: '',
})

const ENUMS = {
  theme: ['ocean', 'aurora', 'candy', 'minimal'],
  panelPlacement: ['left', 'bottom'],
  motion: ['off', 'soft', 'full'],
  toastAnimation: ['pop', 'slide', 'fade'],
  toastPosition: ['top', 'center', 'bottom'],
  soundPack: ['chime', 'arcade', 'ocean', 'custom'],
  eggStyle: ['fireworks', 'whale', 'both'],
}

function bounded(value, fallback, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const clamped = Math.max(min, Math.min(max, value))
  return integer ? Math.round(clamped) : clamped
}

function dataImage(value) {
  return typeof value === 'string' && value.length <= 1_500_000 &&
    /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/u.test(value) ? value : ''
}

function dataAudio(value) {
  return typeof value === 'string' && value.length <= 800_000 &&
    /^data:audio\/(?:mpeg|mp3|wav|x-wav|ogg|webm);base64,[A-Za-z0-9+/=]+$/u.test(value) ? value : ''
}

export function normalizeSettings(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const next = { ...DEFAULT_SETTINGS }
  for (const [key, values] of Object.entries(ENUMS)) {
    if (values.includes(input[key])) next[key] = input[key]
  }
  for (const key of ['soundEnabled', 'jevEnabled', 'eggEnabled', 'eggRequiresJev']) {
    if (typeof input[key] === 'boolean') next[key] = input[key]
  }
  if (typeof input.accent === 'string' && /^#[0-9a-fA-F]{6}$/u.test(input.accent)) next.accent = input.accent
  next.panelOpacity = bounded(input.panelOpacity, next.panelOpacity, 0.65, 1)
  next.volume = bounded(input.volume, next.volume, 0, 1)
  next.eggMinCombo = bounded(input.eggMinCombo, next.eggMinCombo, 3, 30, true)
  next.eggMinTurnPoints = bounded(input.eggMinTurnPoints, next.eggMinTurnPoints, 40, 600, true)
  next.eggCooldownMin = bounded(input.eggCooldownMin, next.eggCooldownMin, 1, 120, true)
  next.eggDurationSec = bounded(input.eggDurationSec, next.eggDurationSec, 3, 10, true)
  next.eggBursts = bounded(input.eggBursts, next.eggBursts, 1, 5, true)
  next.mascotSize = bounded(input.mascotSize, next.mascotSize, 120, 260, true)
  if (typeof input.eggMessage === 'string') next.eggMessage = input.eggMessage.trim().slice(0, 60) || DEFAULT_SETTINGS.eggMessage
  next.customMascot = dataImage(input.customMascot)
  next.customSound = dataAudio(input.customSound)
  return next
}

export function shouldTriggerEgg({ completed, failed, combo, turnPoints, now, lastEggAt, jevChoice, probability }, settings) {
  if (!settings.eggEnabled || !completed || failed) return false
  if (combo < settings.eggMinCombo || turnPoints < settings.eggMinTurnPoints) return false
  if (now - lastEggAt < settings.eggCooldownMin * 60_000) return false
  if (settings.eggRequiresJev && !(jevChoice === 'breakthrough' && probability >= 0.75)) return false
  return true
}
