import { Quester } from 'koishi'
import * as jest from 'jest-mock'
import nock from 'nock'

export const api = nock('https://api.github.com')
export const oauth = () => nock('https://github.com').post('/login/oauth/access_token')

export type MockedReplyCallback = (err: NodeJS.ErrnoException, result: nock.ReplyFnResult) => void
export type MockedReply = jest.Mock<(uri: string, body: nock.Body, callback: MockedReplyCallback) => void>

export function mockResponse(method: Quester.Method, uri: string, payload: nock.ReplyFnResult) {
  const mock: MockedReply = jest.fn((uri, body, callback) => callback(null, payload))
  api.intercept('/repos/koishijs/koishi' + uri, method).reply(mock)
  return mock
}
