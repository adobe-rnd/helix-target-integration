# Target VEC for Helix
The project is a proof of concept for integrating Target VEC with Helix.

## Environments
- Preview: https://main--helix-target-integration--adobe-rnd.hlx.page/
- Live: https://main--helix-target-integration--adobe-rnd.hlx.live/

## CDN setup
We recommend using Cloudflare Workers to proxy all upstream requests to the Target and Helix origins. 
This allows you to use the same domain for both Helix and Target, which is required for archiving the best performance.
Please follow the instructions below to set up the proxy:
- Deploy the CF [worker](cloudflare/worker.js) to your Cloudflare account.
- Add the following environment variables to the worker:
  - `CLIENT` - your Target client code (e.g. `helix-target-integration`)
  - `HOST` - your Helix host (e.g. `dev--helix-target-integration--vtsaplin.hlx.page`)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template and add a mountpoint in the `fstab.yaml`
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/aem-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)
