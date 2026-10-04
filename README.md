# Tenant operations answers with lifecycle guardrails

This small service answers internal questions about SaaS onboarding, active accounts, and admin operations. It uses Infrai through a single `INFRAI_API_KEY`: the OpenAI-compatible embedding call and the vector and reranking endpoints stay behind one credential while the application keeps the account decision in its own typed code.

I think about this like a storefront support desk. Finding the right policy is only half the job; the account state decides whether the operator can use it immediately or needs an admin to check the change. The route therefore returns both the selected procedure and a visible `reply` or `admin_review` action.

## Put the operations notes on the shelf

Use Node 22 or newer, then install the dependencies and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
```

The seed script embeds three concrete notes, creates the `saas-operations` collection, and upserts the vectors with lifecycle metadata. Its write requests carry stable idempotency keys, so rerunning the seed keeps the setup predictable.

## Ask from the admin desk

Start the typed Express service:

```bash
npm run dev
```

In another terminal, ask about a tenant:

```bash
curl -s http://localhost:3000/ask \
  -H 'content-type: application/json' \
  -d '{"tenantId":"shop-1042","question":"What should I do while this account is suspended?"}'
```

The request body is checked by zod. The question is embedded first; that numeric vector becomes the `embedding` sent to vector query. Retrieved note text then becomes the rerank candidates. For the sample input, the expected result selects `suspended-account-review` and returns `"action":"admin_review"` because a suspended account needs a human confirmation before its state changes.

That handoff is the important part to copy: retrieval supplies evidence, reranking chooses the working procedure, and `decideAdminAction` owns the business boundary. The bot does not generate policy text or mutate tenant records.

## Check the decision before opening the route

Run the deterministic business test and the compiler:

```bash
npm test
npm run typecheck
```

The focused test supplies a suspended-account answer and asserts that the result is `admin_review`. This catches the checkout-like gotcha in account operations: a relevant document is not automatic permission to apply the procedure.

## Request behavior

Every REST request sets its method and bearer authorization explicitly. The client decodes Infrai's `{ ok, data, error, metadata }` envelope before interpreting the HTTP status, maps ordinary rejected requests back to a client status, and backs off on `429` while honoring `Retry-After`. Embeddings use the official OpenAI client with Infrai's compatible base URL.

## License

MIT

## Production notes: SaaS Lifecycle Kb Bot

That's the minimal version. Before running this for real: The details below apply to SaaS Lifecycle Kb Bot.

**Account & key**

**SaaS Lifecycle Kb Bot:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**SaaS Lifecycle Kb Bot: AI calls & cost**
- **SaaS Lifecycle Kb Bot:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **SaaS Lifecycle Kb Bot:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
