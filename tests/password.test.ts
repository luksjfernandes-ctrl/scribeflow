import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isRecoveryUrl, recoveryLinkError, translateAuthError, validateNewPassword } from '../src/lib/password.ts'

test('validateNewPassword exige 6 caracteres e confirmação igual', () => {
  assert.match(validateNewPassword('12345', '12345')!, /6 caracteres/)
  assert.match(validateNewPassword('123456', '123457')!, /não são iguais/)
  assert.equal(validateNewPassword('segredo1', 'segredo1'), null)
})

test('isRecoveryUrl reconhece o hash do link de recuperação (fluxo implicit)', () => {
  assert.equal(isRecoveryUrl('#access_token=abc&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery'), true)
  assert.equal(isRecoveryUrl('#type=recovery'), true)
  assert.equal(isRecoveryUrl('#access_token=abc&type=signup'), false)
  assert.equal(isRecoveryUrl('#type=recoveryx'), false)
  assert.equal(isRecoveryUrl(''), false)
})

test('recoveryLinkError traduz link expirado e ignora hash comum', () => {
  assert.match(recoveryLinkError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')!, /expirou/)
  assert.equal(recoveryLinkError('#type=recovery'), null)
  assert.equal(recoveryLinkError(''), null)
})

test('translateAuthError põe em português os erros mais comuns do Supabase', () => {
  assert.match(translateAuthError('email rate limit exceeded'), /Muitos pedidos/)
  assert.match(translateAuthError('For security purposes, you can only request this after 42 seconds.'), /Muitos pedidos/)
  assert.match(translateAuthError('New password should be different from the old password.'), /diferente/)
  assert.match(translateAuthError('Invalid login credentials'), /incorretos/)
  assert.equal(translateAuthError('algo novo'), 'algo novo')
})
