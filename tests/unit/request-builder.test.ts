import { describe, expect, it } from 'vitest'
import { RequestBuilder } from '@client/request-builder'

describe('RequestBuilder', () => {
  it('builds a fully composed request', () => {
    const request = RequestBuilder.post('/booking')
      .withHeader('accept', 'application/json')
      .withQuery('roomid', 1)
      .withBody({ firstname: 'James' })
      .build()

    expect(request).toEqual({
      method: 'POST',
      path: '/booking',
      headers: { accept: 'application/json' },
      query: { roomid: 1 },
      body: { firstname: 'James' },
    })
  })

  it.each([
    ['get', RequestBuilder.get('/room'), 'GET'],
    ['post', RequestBuilder.post('/room'), 'POST'],
    ['put', RequestBuilder.put('/room'), 'PUT'],
    ['delete', RequestBuilder.delete('/room'), 'DELETE'],
  ])('exposes a %s factory', (_name, builder, method) => {
    expect(builder.build()).toMatchObject({ method, path: '/room' })
  })

  it('skips auth injection when no token is given', () => {
    const request = RequestBuilder.put('/room/1').withToken(undefined).build()

    expect(request.headers).toEqual({})
  })

  it('injects the auth token as a cookie', () => {
    const request = RequestBuilder.put('/room/1').withToken('abc123').build()

    expect(request.headers).toEqual({ Cookie: 'token=abc123' })
  })

  it('produces detached copies of headers and query', () => {
    const builder = RequestBuilder.get('/room').withHeader('a', '1').withQuery('q', 'x')
    const first = builder.build()
    builder.withHeader('b', '2').withQuery('r', 'y')

    expect(first.headers).toEqual({ a: '1' })
    expect(first.query).toEqual({ q: 'x' })
  })
})
