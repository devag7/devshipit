# devshipit

Command-line client for the [DevShipIt API](https://devshipit.com/developers/#api): Dev Agarwalla's profile, projects, freelance services, FAQ, contact details and every devshipit.com page as Markdown. Node.js 20 or newer, no dependencies.

```sh
npx github:devag7/devshipit projects
npx github:devag7/devshipit project jantahr
npx github:devag7/devshipit page /pricing/
npx github:devag7/devshipit faq --json
```

Commands: `profile`, `projects`, `project <slug>`, `services`, `faq`, `contact`, `pages`, `page <path>`, `api`. Options: `--json`, `--base <url>` (or `DEVSHIPIT_API`), `--help`, `--version`.

Exit codes: 0 success, 1 API error (the API's `code` and `hint` are printed), 2 usage error, 3 network error.

The API is described by an OpenAPI 3.1 document at https://devshipit.com/openapi.json.
