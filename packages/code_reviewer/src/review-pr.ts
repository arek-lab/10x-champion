import { reviewPullRequest } from "./index.js";

/**
 * CI entrypoint for reviewing a pull request. Reads the PR title/body/diff from
 * environment variables (set by the GitHub Actions workflow / composite action)
 * and prints the structured verdict as a single line of JSON to stdout, so a
 * `run` step can capture it into `$GITHUB_OUTPUT`.
 *
 *   PR_TITLE  — pull request title   (optional)
 *   PR_BODY   — pull request body    (optional)
 *   PR_DIFF   — unified diff         (required; falls back to stdin if unset)
 *
 * Only the JSON goes to stdout; diagnostics go to stderr so the captured output
 * stays parseable.
 */

/** Reads all of stdin as a string (used when `PR_DIFF` is not set). */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main(): Promise<void> {
  const title = process.env.PR_TITLE ?? "";
  const body = process.env.PR_BODY ?? "";
  const diff = process.env.PR_DIFF ?? (await readStdin());

  if (diff.trim() === "") {
    throw new Error("No diff to review: set PR_DIFF or pipe a diff via stdin.");
  }

  const review = await reviewPullRequest({ title, body, diff });
  console.log(JSON.stringify(review));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
