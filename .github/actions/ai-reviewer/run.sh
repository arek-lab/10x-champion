#!/usr/bin/env bash
#
# Installs the code-reviewer package and runs it against the PR diff supplied via
# the PR_TITLE / PR_BODY / PR_DIFF environment variables. The agent prints a
# single line of JSON to stdout; we capture it, echo it into the job log (for the
# evidence screenshot), and expose it as the composite action's `verdict` output.
set -euo pipefail

# actions/setup-node exports NODE_OPTIONS=--use-system-ca, which Node 22.14
# rejects inside NODE_OPTIONS (it is only valid as a CLI flag). Left set, it
# breaks esbuild's postinstall (a fresh `node install.js`) and tsx. Neutralize
# it for this script.
unset NODE_OPTIONS

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
