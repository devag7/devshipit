# devshipit.com

Source for [devshipit.com](https://devshipit.com), the portfolio and product site of Dev Agarwalla.

Plain HTML and CSS, no build step. Everything that gets served lives in `public/`.

## Deploying

Cloudflare Workers Builds is connected to this repository. A push to `main` deploys the site; there is nothing to run by hand.

- Worker name: `odd-fog-f7c1` (see `wrangler.jsonc`)
- Custom domains: `devshipit.com` and `www.devshipit.com`

## Editing

Edit any file under `public/`, commit to `main`, and the live site updates within a minute or two. Shared styles are in `public/assets/site.css`.
