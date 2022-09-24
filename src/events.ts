import { EventPayloadMap, Issue, PullRequest, Repository, WebhookEventName } from '@octokit/webhooks-types/schema'
import { Awaitable, Context, Dict } from 'koishi'
import { EventData } from './server'
import { transform } from './markdown'

type Camelize<S extends string> = S extends `${infer L}_${infer M}${infer R}` ? `${L}${Uppercase<M>}${Camelize<R>}` : S

type ActionName<E extends WebhookEventName> = EventPayloadMap[E] extends { action: infer A } ? A & string : never

export type EventFilter = {
  [E in WebhookEventName as Camelize<E>]?: EventPayloadMap[E] extends { action: infer A }
    ? boolean | { [K in A & string as Camelize<K>]?: boolean }
    : boolean
}

type SubEvent<E extends WebhookEventName> = `${E}/${ActionName<E>}`

export type EmitterWebhookEventName = keyof {
  [E in WebhookEventName as E | `${E}/${ActionName<E>}`]: any
}

export interface CommonPayload {
  action?: string
  repository?: Repository
}

export type Payload<T extends EmitterWebhookEventName> = T extends `${infer E}/${infer A}`
  ? EventPayloadMap[E & WebhookEventName] & { action: A }
  : EventPayloadMap[T & WebhookEventName]

export type EventHandler<T extends EmitterWebhookEventName, P = {}> = (payload: Payload<T>) => Awaitable<EventData<P>>

type FactoryCreator = <T extends EmitterWebhookEventName, P = {}>
  (callback: (event: T, payload: Payload<T>, handler: EventHandler<T, P>) => Awaitable<EventData<P>>)
    => <E extends T>(event: E, handler?: EventHandler<E, P>) => void

export default function events(ctx: Context) {
  const createFactory: FactoryCreator = (callback) => (event, handler) => {
    ctx.github.on(event, payload => Reflect.apply(callback, null, [event, payload, handler]))
  }

  type CommentEvent = 'commit_comment' | 'issue_comment' | 'pull_request_review_comment'

  interface CommentReplyPayloads {
    padding?: number[]
  }

  const onComment = createFactory<CommentEvent, CommentReplyPayloads>(async (event, payload, handler) => {
    const { user, body, html_url, url } = payload.comment
    if (user.type === 'Bot') return

    const [target, replies] = await handler(payload)
    if (payload.action === 'deleted') {
      return [`${user.login} deleted a comment on ${target}`]
    }

    const { padding } = replies
    delete replies.padding

    const index = html_url.indexOf('#')
    const operation = payload.action === 'created' ? 'commented' : 'edited a comment'
    return [`${user.login} ${operation} on ${target}\n${transform(body)}`, {
      link: [html_url],
      react: [url + `/reactions`],
      shot: [
        html_url.slice(0, index),
        html_url.slice(index),
        padding,
      ],
      ...replies,
    }]
  })

  onComment('commit_comment', ({ repository, comment }) => {
    const { full_name } = repository
    const { commit_id, path, position } = comment
    return [`commit ${full_name}@${commit_id.slice(0, 6)}\nPath: ${path}`, {
      // https://docs.github.com/en/rest/reference/repos#create-a-commit-comment
      reply: [`https://api.github.com/repos/${full_name}/commits/${commit_id}/comments`, { path, position }],
    }]
  })

  const onReference = createFactory<'create' | 'delete'>((event, { repository, ref, ref_type, sender }) => {
    const ref_name = `${repository.full_name}${ref_type === 'tag' ? '@' : ':'}${ref}`
    return [`${sender.login} ${event}d ${ref_type} ${ref_name}`]
  })

  onReference('create')

  onReference('delete')

  ctx.github.on('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  onComment('issue_comment', ({ issue, repository }) => {
    const { full_name } = repository
    const { number, comments_url } = issue
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    return [`${type} ${full_name}#${number}`, {
      reply: [comments_url],
      padding: [16, 16, 16, 88],
    }]
  })

  const onIssue = createFactory<SubEvent<'issues'>>(async (event, payload, handler) => {
    const { user, url, html_url, comments_url } = payload.issue
    if (user.type === 'Bot') return

    const result = await handler(payload)
    if (!result) return
    return [result[0], {
      close: [url, comments_url],
      link: [html_url],
      react: [url + `/reactions`],
      reply: [comments_url],
      ...result[1],
    }]
  })

  function getIssueName(issue: Issue, repository: Repository) {
    return `${repository.full_name}#${issue.number}`
  }

  onIssue('issues/transferred', ({ repository, issue, changes, sender }) => {
    const oldName = getIssueName(issue, repository)
    const newName = getIssueName(changes.new_issue, changes.new_repository)
    return [`${sender.login} transferred issue ${oldName} to ${newName}`]
  })

  onIssue('issues/opened', ({ repository, issue, changes, sender }) => {
    const { full_name } = repository
    const { title, body, number } = issue as Issue
    const name = `${full_name}#${number}`

    // issue transfer
    if (changes) return
    return [[
      `${sender.login} opened an issue ${name}`,
      `Title: ${title}`,
      transform(body),
    ].join('\n')]
  })

  onIssue('issues/closed', ({ repository, issue, sender }) => {
    const { full_name } = repository
    const { title, number } = issue
    return [`${sender.login} closed issue ${full_name}#${number}\n${title}`]
  })

  onComment('pull_request_review_comment', ({ repository, comment, pull_request }) => {
    const { full_name } = repository
    const { number } = pull_request
    const { path, url } = comment
    return [`pull request review ${full_name}#${number}\nPath: ${path}`, {
      reply: [url],
    }]
  })

  ctx.github.on('milestone/created', ({ repository, milestone, sender }) => {
    const { full_name } = repository
    const { title, description } = milestone
    return [`${sender.login} created milestone ${title} for ${full_name}\n${description}`]
  })

  ctx.github.on('pull_request_review/submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    const { full_name } = repository
    const { number, comments_url } = pull_request
    const { user, html_url, body } = review
    if (user.type === 'Bot') return

    return [[
      `${user.login} reviewed pull request ${full_name}#${number}`,
      transform(body),
    ].join('\n'), {
      link: [html_url],
      reply: [comments_url],
    }]
  })

  const onPullRequest = createFactory<SubEvent<'pull_request'>>(async (event, payload, handler) => {
    const { user, url, html_url, issue_url, comments_url } = payload.pull_request
    if (user.type === 'Bot') return

    const [message, replies] = await handler(payload)
    return [message, {
      base: [url],
      close: [issue_url, comments_url],
      link: [html_url],
      merge: [url + '/merge'],
      rebase: [url + '/merge'],
      squash: [url + '/merge'],
      react: [issue_url + `/reactions`],
      reply: [comments_url],
      ...replies,
    }]
  })

  onPullRequest('pull_request/closed', ({ repository, pull_request, sender }) => {
    const { full_name } = repository
    const { title, number, merged } = pull_request
    const type = merged ? 'merged' : 'closed'
    return [`${sender.login} ${type} pull request ${full_name}#${number}\n${title}`]
  })

  onPullRequest('pull_request/reopened', ({ repository, pull_request, sender }) => {
    const { full_name } = repository
    const { title, number } = pull_request
    return [`${sender.login} reopened pull request ${full_name}#${number}\n${title}`]
  })

  onPullRequest('pull_request/opened', ({ repository, pull_request, sender }) => {
    const { full_name, owner } = repository
    const { title, base, head, body, number, draft } = pull_request as PullRequest

    const prefix = new RegExp(`^${owner.login}:`)
    const baseLabel = base.label.replace(prefix, '')
    const headLabel = head.label.replace(prefix, '')
    return [[
      `${sender.login} ${draft ? 'drafted' : 'opened'} a pull request ${full_name}#${number} (${baseLabel} ← ${headLabel})`,
      `Title: ${title}`,
      transform(body),
    ].join('\n')]
  })

  onPullRequest('pull_request/review_requested', (payload) => {
    const { repository, pull_request, sender } = payload
    const { full_name } = repository
    const { number } = pull_request
    return ['requested_reviewer' in payload
      ? `${sender.login} requested a review from ${payload.requested_reviewer.login} on ${full_name}#${number}`
      : `${sender.login} requested a review from team ${payload.requested_team.name} on ${full_name}#${number}`]
  })

  onPullRequest('pull_request/converted_to_draft', ({ repository, pull_request, sender }) => {
    const { full_name } = repository
    const { number } = pull_request as PullRequest
    return [`${sender.login} marked ${full_name}#${number} as draft`]
  })

  onPullRequest('pull_request/ready_for_review', ({ repository, pull_request, sender }) => {
    const { full_name } = repository
    const { number } = pull_request as PullRequest
    return [`${sender.login} marked ${full_name}#${number} as ready for review`]
  })

  ctx.github.on('push', ({ compare, pusher, sender, commits, repository, ref, before, after }) => {
    const { full_name } = repository
    if (sender.type === 'Bot') return

    // do not show branch create / delete
    if (/^0+$/.test(before) || /^0+$/.test(after)) return

    return [[
      `${pusher.name} pushed to ${full_name}:${ref.replace(/^refs\/heads\//, '')}`,
      ...commits.map(c => `[${c.id.slice(0, 6)}] ${transform(c.message)}`),
    ].join('\n'), {
      link: [compare],
    }]
  })

  ctx.github.on('star/created', ({ repository, sender }) => {
    const { full_name, stargazers_count } = repository
    return [`${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
