import { App, Bot, Random, sleep } from 'koishi'
import { expect } from 'chai'
import { readdirSync } from 'fs'
import { resolve } from 'path'
import { mockResponse } from './utils'
import * as jest from 'jest-mock'
import * as github from 'koishi-plugin-github'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'

const app = new App({
  prefix: '.',
})

app.plugin(memory)
app.plugin(mock)

const client = app.mock.client('123', '999')

const snapshots = require('./snapshots')

function* listFixtures(cwd: string, prefix = ''): Generator<string> {
  const dirents = readdirSync(cwd, { withFileTypes: true })
  for (const dirent of dirents) {
    const name = resolve(cwd, dirent.name)
    if (dirent.isDirectory()) {
      yield* listFixtures(resolve(cwd, dirent.name), prefix + dirent.name + '/')
    } else if (dirent.isFile() && name.endsWith('.json')) {
      yield prefix + dirent.name.slice(0, -5)
    }
  }
}

describe('koishi-plugin-github (events)', () => {
  before(async () => {
    await app.start()
    await app.mock.initUser('123', 3, {
      github: {
        accessToken: '114514',
        refreshToken: '1919810',
      },
    })
    await app.database.createChannel('mock', '999', {
      assignee: app.bots[0].selfId,
      github: {
        webhooks: { 'koishijs/koishi': {} },
      },
    })
    app.plugin(github)
    await sleep(0)
  })

  after(() => app.stop())

  const idMap: Record<string, string> = {}

  describe('Webhook Events', () => {
    // spy on sendMessage
    const sendMessage = app.bots[0].sendMessage = jest.fn<Bot['sendMessage']>()

    for (const title of listFixtures(resolve(__dirname, 'fixtures'))) {
      it(title, async () => {
        sendMessage.mockClear()
        sendMessage.mockImplementation(() => {
          return Promise.resolve([idMap[title] = Random.id()])
        })

        const payload = require(`./fixtures/${title}`)
        const event = title.split(title.includes('/') ? '/' : '.', 1)[0]
        app.emit('github/webhook', event, payload)

        // wait until all messages are sent
        await sleep(0)
        if (snapshots[title]) {
          expect(sendMessage.mock.calls).to.have.length(1)
          expect(sendMessage.mock.calls[0][1]).to.equal(snapshots[title])
        } else {
          expect(sendMessage.mock.calls).to.have.length(0)
        }
      })
    }
  })

  describe('Quick Interactions', () => {
    it('no operation', async () => {
      await client.shouldNotReply(`<quote id="${idMap['issue_comment/created.1']}"/>`)
      await client.shouldNotReply(`<quote id="${idMap['issue_comment/created.1']}"/> .noop`)
    })

    it('link', async () => {
      await client.shouldReply(
        `<quote id=${idMap['issue_comment/created.1']}/> .link`,
        'https://github.com/koishijs/koishi/issues/19#issuecomment-576277946',
      )
    })

    it('react', async () => {
      const reaction = mockResponse('POST', '/issues/comments/576277946/reactions', [200])
      await client.shouldNotReply(`<quote id=${idMap['issue_comment/created.1']}/> laugh`)
      expect(reaction.mock.calls).to.have.length(1)
    })

    it('reply', async () => {
      const comment = mockResponse('POST', '/issues/19/comments', [200])
      await client.shouldNotReply(`<quote id=${idMap['issue_comment/created.1']}/> test`)
      expect(comment.mock.calls).to.have.length(1)
    })

    it('close', async () => {
      const api1 = mockResponse('PATCH', '/issues/20', [200])
      const api2 = mockResponse('POST', '/issues/20/comments', [200])
      await client.shouldNotReply(`<quote id=${idMap['pull_request/opened.1']}/> .close foo`)
      expect(api1.mock.calls).to.have.length(1)
      expect(api2.mock.calls).to.have.length(1)
    })

    it('base', async () => {
      const api = mockResponse('PATCH', '/pulls/20', [200])
      await client.shouldNotReply(`<quote id=${idMap['pull_request/opened.1']}/> .base foo`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('merge', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`<quote id=${idMap['pull_request/opened.1']}/> .merge`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('rebase', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`<quote id=${idMap['pull_request/opened.1']}/> .rebase`)
      expect(api.mock.calls).to.have.length(1)
    })

    it('squash', async () => {
      const api = mockResponse('PUT', '/pulls/20/merge', [200])
      await client.shouldNotReply(`<quote id=${idMap['pull_request/opened.1']}/> .squash`)
      expect(api.mock.calls).to.have.length(1)
    })
  })
})
