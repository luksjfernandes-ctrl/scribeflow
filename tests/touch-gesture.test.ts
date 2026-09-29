import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { autoScrollSpeed, onTouchEndAction, onTouchMovePhase } from '../src/lib/touchGesture.ts'

const at = (phase: 'pressing' | 'armed' | 'dragging' | 'idle') => ({ phase, startX: 100, startY: 100 })

test('deslizar antes do toque longo vira rolagem', () => {
  assert.equal(onTouchMovePhase(at('pressing'), 100, 130), 'idle')
  assert.equal(onTouchMovePhase(at('pressing'), 103, 104), 'pressing')
})

test('toque longo e mover vira arraste; tremida pequena nao', () => {
  assert.equal(onTouchMovePhase(at('armed'), 100, 125), 'dragging')
  assert.equal(onTouchMovePhase(at('armed'), 104, 103), 'armed')
})

test('soltar: parado abre o menu, arrastando solta, toque curto nao faz nada', () => {
  assert.equal(onTouchEndAction(at('armed')), 'menu')
  assert.equal(onTouchEndAction(at('dragging')), 'drop')
  assert.equal(onTouchEndAction(at('pressing')), 'none')
  assert.equal(onTouchEndAction(at('idle')), 'none')
})

test('rolagem automatica perto das bordas', () => {
  assert.equal(autoScrollSpeed(300, 100, 600), 0)
  assert.ok(autoScrollSpeed(105, 100, 600) < 0)
  assert.ok(autoScrollSpeed(595, 100, 600) > 0)
  assert.ok(autoScrollSpeed(595, 100, 600) > autoScrollSpeed(570, 100, 600))
})
