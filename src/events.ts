import { EventPayloadMap, Issue, PullRequest, Repository, WebhookEventName } from '@octokit/webhooks-types/schema'
import { Awaitable, Context } from 'koishi'
import { EventData } from './reply'
import { transform } from './markdown'
import GitHub from '.'

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

export default function events(ctx: Context, github: GitHub) {
  const createFactory: FactoryCreator = (callback) => (event, handler) => {
    github.on(event, payload => Reflect.apply(callback, null, [event, payload, handler]))
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
      return [`${payload.sender.login} deleted a comment on ${target}`]
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

  github.on('fork', ({ repository, sender, forkee }) => {
    const { full_name, forks_count } = repository
    return [`${sender.login} forked ${full_name} to ${forkee.full_name} (total ${forks_count} forks)`]
  })

  onComment('issue_comment', ({ issue, repository }) => {
    const { comments_url } = issue
    const type = issue['pull_request'] ? 'pull request' : 'issue'
    const name = getIssueName(issue, repository)
    return [`${type} ${name}`, {
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

  function getIssueName(issue: { number: number }, repository: Repository) {
    return `${repository.full_name}#${issue.number}`
  }

  onIssue('issues/transferred', ({ repository, issue, changes, sender }) => {
    const oldName = getIssueName(issue, repository)
    const newName = getIssueName(changes.new_issue, changes.new_repository)
    return [`${sender.login} transferred issue ${oldName} to ${newName}\n${issue.title}`]
  })

  onIssue('issues/opened', ({ repository, issue, changes, sender }) => {
    const { title, body } = issue as Issue
    const name = getIssueName(issue, repository)

    // ignore issue transfer
    if (changes) return
    return [[
      `${sender.login} opened an issue ${name}`,
      `Title: ${title}`,
      transform(body),
    ].join('\n')]
  })

  onIssue('issues/closed', ({ repository, issue, sender }) => {
    const name = getIssueName(issue, repository)
    return [`${sender.login} closed issue ${name}\n${issue.title}`]
  })

  onIssue('issues/reopened', ({ repository, issue, sender }) => {
    const name = getIssueName(issue, repository)
    return [`${sender.login} reopened issue ${name}\n${issue.title}`]
  })

  onComment('pull_request_review_comment', ({ repository, comment, pull_request }) => {
    const { full_name } = repository
    const { number } = pull_request
    const { id, path } = comment
    const name = getIssueName(pull_request, repository)
    return [`pull request review ${name}\nPath: ${path}`, {
      // https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment
      reply: [`https://api.github.com/repos/${full_name}/pulls/${number}/comments/${id}/replies`],
    }]
  })

  github.on('milestone', ({ action, repository, milestone, sender }) => {
    const { full_name } = repository
    const { title } = milestone
    if (!['opened', 'closed'].includes(action)) return
    return [`${sender.login} ${action} milestone ${title} for ${full_name}`]
  })

  github.on('pull_request_review/submitted', ({ repository, review, pull_request }) => {
    if (!review.body) return
    const { comments_url } = pull_request
    const { user, html_url, body } = review
    if (user.type === 'Bot') return

    const name = getIssueName(pull_request, repository)
    return [[
      `${user.login} reviewed pull request ${name}`,
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
    const { title, merged } = pull_request
    const type = merged ? 'merged' : 'closed'
    const name = getIssueName(pull_request, repository)
    return [`${sender.login} ${type} pull request ${name}\n${title}`]
  })

  onPullRequest('pull_request/reopened', ({ repository, pull_request, sender }) => {
    const { title } = pull_request
    const name = getIssueName(pull_request, repository)
    return [`${sender.login} reopened pull request ${name}\n${title}`]
  })

  onPullRequest('pull_request/opened', ({ repository, pull_request, sender }) => {
    const { owner } = repository
    const { title, base, head, body, draft } = pull_request as PullRequest

    const prefix = new RegExp(`^${owner.login}:`)
    const baseLabel = base.label.replace(prefix, '')
    const headLabel = head.label.replace(prefix, '')
    const name = getIssueName(pull_request, repository)
    return [[
      `${sender.login} ${draft ? 'drafted' : 'opened'} a pull request ${name} (${baseLabel} ← ${headLabel})`,
      `Title: ${title}`,
      transform(body),
    ].join('\n')]
  })

  onPullRequest('pull_request/review_requested', (payload) => {
    const { repository, pull_request, sender } = payload
    const name = getIssueName(pull_request, repository)
    return ['requested_reviewer' in payload
      ? `${sender.login} requested a review from ${payload.requested_reviewer.login} on ${name}`
      : `${sender.login} requested a review from team ${payload.requested_team.name} on ${name}`]
  })

  onPullRequest('pull_request/converted_to_draft', ({ repository, pull_request, sender }) => {
    const name = getIssueName(pull_request, repository)
    return [`${sender.login} marked ${name} as draft`]
  })

  onPullRequest('pull_request/ready_for_review', ({ repository, pull_request, sender }) => {
    const name = getIssueName(pull_request, repository)
    return [`${sender.login} marked ${name} as ready for review`]
  })

  github.on('push', ({ compare, pusher, sender, commits, repository, ref, before, after }) => {
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

  github.on('star/created', ({ repository, sender }) => {
    const { full_name, stargazers_count } = repository
    return [`${sender.login} starred ${full_name} (total ${stargazers_count} stargazers)`]
  })
}
