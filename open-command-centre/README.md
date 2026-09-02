# Open Command Centre

A zero-dependency, provider-neutral command-centre shell for organisations that want one admitted action queue with clear ownership, authority, next action, blockers, escalation and evidence.

## Run locally

Serve this directory with any static file server. For example:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Feed contract

The bundled `example-actions.json` uses `open-command-centre.feed.v1`. Each action has exactly:

- `id`
- `view`
- `outcome`
- `owner`
- `authority`
- `nextAction`
- `deadline`
- `blocker`
- `state`
- `evidence`
- `escalation`
- `priority`

Invalid records fail closed. A local JSON file can be loaded from the browser without uploading it anywhere.

## Security boundary

This package is a display and validation shell. It deliberately contains no credentials, private state, identity provider, policy engine, worker runtime, connector, payment rail or execution authority.

Put consequential execution behind your own authenticated adapter. That adapter should evaluate identity, authority, evidence, duplication, suppression, stop events and policy before it calls any tool.

## License

MIT. See `LICENSE`.
