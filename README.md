# Visual Design Studio — Plan A

Research platform for comparing autonomous Human Design and AI Design under the same brief, canvas, editable resources, renderer and complexity measures.

## What is different in Plan A

- 67 categorised, editable design elements and a searchable library.
- 48 default colours plus a HEX input and colour picker. All elements use fully opaque solid colours.
- No experimental element-count limit, time limit, countdown or forced submission. Actual time and actions are still recorded.
- AI Design uses `gpt-6.1-sol` structured output through Netlify AI Gateway. GPT returns element parameters; the website renders those elements with the same library used by Human Design.
- The server-side instruction treats resources as options, not a checklist, and does not prescribe a number of elements/colours, a complexity level, composition style or aesthetic.
- Both conditions export the same three primary design measures: element count, distinct shape types and distinct colours.
- Published experiment versions, submissions, PNG files and metadata are stored with Netlify Blobs.

## Deploy from a new GitHub repository

1. Create an empty GitHub repository and upload **the contents of this folder** (do not upload the containing ZIP as one file).
2. In Netlify choose **Add new project → Import an existing project → GitHub** and select the new repository.
3. Netlify reads `netlify.toml` automatically:
   - build command: `pnpm build`
   - publish directory: `dist`
   - functions directory: `netlify/functions`
4. Deploy to production once. AI Gateway is injected only after a production deploy.
5. Add `VDS_ADMIN_PASSWORD` as a secret environment variable for the researcher console, then trigger a new deploy.
6. Open `/admin`, create an experiment, publish it, and test both generated participant links in an incognito window.

Netlify automatically provides `OPENAI_API_KEY` and `OPENAI_BASE_URL` when AI Gateway is active. Do not manually add provider keys unless intentionally using your own OpenAI account.

## Important research details

- Normal participant AI requests are resolved against the server-side published experiment. Browser-supplied shape or colour rules cannot replace the published rules.
- Researcher previews use the latest saved draft; published links use the immutable published version.
- The 500-element value inside validation is only a technical anti-abuse/rendering safeguard, not a participant-facing design rule.
- The background can be configured per experiment and Human/AI use the same starting background.

## Local checks

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm build
pnpm dev
```

Live AI generation requires a Netlify-linked environment (`netlify dev`) or a production deployment because the gateway credentials are server-only.
