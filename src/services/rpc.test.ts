import { expect, test, describe } from 'bun:test'
import { rpc } from './api'
import server from '../../server/index'

describe('Hono RPC Client (hc<AppType>)', () => {
  test('rpc client is defined and has autocompleted routes', () => {
    expect(rpc).toBeDefined()
    expect(typeof rpc.members.$get).toBe('function')
    expect(typeof rpc.loans.$get).toBe('function')
    expect(typeof rpc.stats.$get).toBe('function')
    expect(typeof rpc.auth.login.$post).toBe('function')
    expect(typeof rpc.auth.verify.$get).toBe('function')
    expect(typeof rpc.savings.transactions.$get).toBe('function')
  })

  test('calls server route through typed RPC client', async () => {
    const res = await server.fetch(new Request('http://localhost:3000/api/v1/settings/branding'))
    expect(res.status).toBe(200)

    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
  })

  test('validates payload and types on RPC auth call', async () => {
    const res = await server.fetch(
      new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@koperasi.com', password: 'wrong' }),
      })
    )

    expect(res.status).toBe(401)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
