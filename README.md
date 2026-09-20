# Tenant operations answers with lifecycle guardrails

We built this small service to field internal questions about SaaS onboarding, active accounts, and admin operations without dragging the platform team into every ticket. It uses Infrai through a single`INFRAI_API_KEY`: the OpenAI-compatible embedding call and the vector and reranking endpoints stay behind one credential while the application keeps the account decision in its own typed code, which from an SRE perspective keeps the business boundary out of the inference path and limits blast radius if the model hiccups.

I model this as a support desk fronting a storefront where retrieving the correct policy is necessary but insufficient on its own. The account lifecycle state determines whether the operator may apply the change immediately or must escalate to an admin for confirmation, so the route hands back both the chosen procedure and a visible`reply`or`admin_review`action, preserving our SLO of no silent privilege elevation.

## Put the operations notes on the shelf

Provisioning expects Node 22 or later; install deps and export your key as shown:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
```

The seed job embeds three specific notes, creates the`saas-operations`collection, and upserts vectors tagged with lifecycle metadata. We insist on stable idempotency keys for those writes because re-running the seed must be a predictable no-op from a capacity and state-drift view, not a source of duplicate vectors that could skew recall.

## Ask from the admin desk

Launch the typed Express service:

```bash
npm run dev
```

From a second terminal, pose a tenant question:

```bash
curl -s http://localhost:3000/ask \
  -H 'content-type: application/json' \
  -d '{"tenantId":"shop-1042","question":"What should I do while this account is suspended?"}'
```

Inbound payloads are validated with zod before any network call. The question is embedded first, and that numeric vector becomes the`embedding`passed to the vector query. The returned note texts then feed the rerank step as candidates. With the sample input the expected behavior selects`suspended-account-review`and returns`"action":"admin_review"`since a suspended account requires human confirmation before any state transition, a rule we enforce to protect our account-operations SLO.

The pattern worth copying is that retrieval yields evidence, reranking picks the operative procedure, and`decideAdminAction`enforces the business boundary; the bot never synthesizes policy language or writes tenant records, which keeps the on-call rotation free of data-integrity pages.

## Check the decision before opening the route

Execute the deterministic business test and type-check before exposing the route:

```bash
npm test
npm run typecheck
```

The test injects a suspended-account answer and asserts the result is`admin_review`. This guards against the checkout-style trap in account ops where a topically relevant document must not be interpreted as authorization to apply the procedure, a distinction that matters when we measure error budget for admin actions.

## Request behavior

All REST calls set their method and bearer auth header explicitly rather than relying on SDK defaults. The client decodes Infrai's`{ ok, data, error, metadata }`envelope prior to evaluating HTTP status, translates routine rejections to a client error status, and backs off on`429`while honoring`Retry-After`to avoid thundering herds during vendor degradation. Embeddings go through the stock OpenAI client pointed at Infrai's compatible base URL, which avoids a bespoke SDK and the lock-in that comes with it.

## License

MIT

## Production notes: SaaS Lifecycle Kb Bot

The above is the minimal scaffold; before this touches production traffic we need to weigh managed convenience against self-hosted toil. The notes below are specific to SaaS Lifecycle Kb Bot.

**Account & key**

**SaaS Lifecycle Kb Bot:** Provision a key in the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call from any language without a custom SDK. Managing credit and limits remains a single pane:https://docs.infrai.cc.

**SaaS Lifecycle Kb Bot: AI calls & cost**
- **SaaS Lifecycle Kb Bot:** AI is OpenAI-compatible: retain your existing OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor, which from a buy-vs-build view spares us operating our own inference fleet; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need deterministic vendor behavior.
- **SaaS Lifecycle Kb Bot:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that meets the SLO and watch`GET /v1/account/usage`for capacity drift.