import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { reviewCode, type Review } from "./index.js";

/**
 * CLI entrypoint for the code reviewer. Reviews a file path argument or piped
 * stdin and prints a human-readable report (or, with `--json`, the raw `Review`).
 *
 * Zero-dependency: argv parsing is manual, honoring the package's no-new-deps
 * rule. The barrel (`index.ts`) stays side-effect-free; all script/entry
 * behavior lives here.
 */

/** Parsed CLI options. */
interface CliOptions {
  filePath?: string;
  json: boolean;
  language?: string;
  help: boolean;
}

/** Maps a file extension (without dot) to a language hint for the prompt. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
};

/** Parses `process.argv.slice(2)` with zero-dep manual parsing. */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg === "--json") {
      options.json = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--language") {
      // `--language <lang>`: consume the next token as the value.
      options.language = argv[i + 1];
      i++;
    } else if (arg.startsWith("--language=")) {
      options.language = arg.slice("--language=".length);
    } else if (!arg.startsWith("-") && options.filePath === undefined) {
      // First non-flag token is the input file path.
      options.filePath = arg;
    }
  }

  return options;
}

/** Usage text printed for `--help` and bare TTY invocations. */
function printUsage(): void {
  console.log(
    [
      "Usage: code-reviewer [options] [file]",
      "",
      "Reviews a code file (or piped stdin) and prints a report.",
      "",
      "Arguments:",
      "  file                 Path to the file to review. If omitted, reads stdin.",
      "",
      "Options:",
      "  --json               Print the raw Review object as JSON.",
      "  --language <lang>    Language hint (overrides extension inference).",
      "  -h, --help           Show this help.",
      "",
      "Examples:",
      "  code-reviewer src/index.ts",
      "  code-reviewer --json src/index.ts",
      "  cat foo.py | code-reviewer --language python",
    ].join("\n"),
  );
}

/** Reads the review input from a file path, or from piped stdin. */
async function readInput(filePath?: string): Promise<string> {
  if (filePath) return readFile(filePath, "utf8");

  if (process.stdin.isTTY) {
    printUsage();
    process.exit(0);
  }

  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

/** Infers a language hint from a file's extension, or `undefined` if unknown. */
function inferLanguage(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const ext = extname(filePath).slice(1).toLowerCase();
  return EXT_TO_LANGUAGE[ext];
}

/** Renders a `Review` as a human-readable report. Pure (model-free, testable). */
export function formatReview(review: Review): string {
  const lines: string[] = [review.summary, ""];

  if (review.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }

  for (const finding of review.findings) {
    const location = finding.line === null ? "" : ` L${finding.line}:`;
    lines.push(`[${finding.severity}]${location} ${finding.message}`);
    if (finding.suggestion) {
      lines.push(`  → ${finding.suggestion}`);
    }
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const code = await readInput(options.filePath);
  if (code.trim() === "") {
    throw new Error("No code to review: input was empty.");
  }

  const language = options.language ?? inferLanguage(options.filePath);
  const review = await reviewCode(code, language);

  if (options.json) {
    console.log(JSON.stringify(review, null, 2));
  } else {
    console.log(formatReview(review));
  }
}

// Run `main` only when executed as a script, not when imported (cross-platform).
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
