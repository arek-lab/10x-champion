#!/usr/bin/env bash
#
# Installs the code-reviewer package and runs it against the PR diff supplied via
# the PR_TITLE / PR_BODY / PR_DIFF environment variables. The agent prints a
# single line of JSON to stdout; we capture it, echo it into the job log (for the
# evidence screenshot), and expose it as the composite action's `verdict` output.
set -euo pipefail

# The committed .npmrc files set `node-options=--use-system-ca`; npm injects that
# into every lifecycle script (e.g. esbuild's postinstall), and Node 22.14
# rejects --use-system-ca *inside* NODE_OPTIONS (CLI-flag only), failing
# `npm ci` with exit code 9. An empty `npm_config_node_options` env is treated as
# unset, so instead strip the directive from the ephemeral CI checkout. CI uses
# the default CA bundle and does not need it.
unset NODE_OPTIONS
for rc in "$GITHUB_WORKSPACE/.npmrc" "$GITHUB_WORKSPACE/packages/code_reviewer/.npmrc"; do
  [ -f "$rc" ] && sed -i '/node-options/d' "$rc"
done

cd "$GITHUB_WORKSPACE/packages/code_reviewer"

echo "Installing reviewer dependencies..." >&2
npm ci --no-audit --no-fund >&2

echo "Running AI code review..." >&2
verdict="$(npm run --silent review)"

# Surface the verdict in the job log (collapsible group).
echo "::group::AI review verdict" >&2
echo "$verdict" >&2
echo "::endgroup::" >&2

# Expose the full JSON as the action output `verdict` (multiline-safe).
{
  echo "verdict<<__VERDICT_EOF__"
  echo "$verdict"
  echo "__VERDICT_EOF__"
} >> "$GITHUB_OUTPUT"
