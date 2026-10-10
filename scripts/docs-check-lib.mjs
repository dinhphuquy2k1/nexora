import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const requiredEntryPoints = [
  "README.md",
  "AGENTS.md",
  "docs/README.md",
  "docs/ai/README.md",
  "docs/ai/PROJECT_CONTEXT.md",
  "docs/ai/PROJECT_RULES.md",
  "docs/ai/TASK_WORKFLOW.md",
  "docs/ai/IMPLEMENTATION_WORKFLOW.md",
  "docs/ai/DOCUMENT_ROUTER.md",
  "docs/decisions/README.md",
  "docs/architecture/overview.md",
  "docs/operations/setup.md",
  "docs/operations/testing.md",
];

export const HISTORICAL_TASKS = new Set(["NEXORA-001", "NEXORA-002"]);

const verificationValues = new Set([
  "VERIFIED",
  "PARTIALLY VERIFIED",
  "NOT VERIFIED",
]);
const evidenceHeaders = ["Claim", "Evidence", "Date", "Result"];

export const exists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

export const markdownFiles = async (directory) => {
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(target);
      return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
    }),
  );
  return nested.flat();
};

export const withoutFencedCode = (source) => {
  let fence;
  return source
    .split("\n")
    .map((line) => {
      const match = line.match(/^\s*(`{3,}|~{3,})/);
      if (match && !fence) {
        fence = match[1][0];
        return "";
      }
      if (match && fence === match[1][0]) {
        fence = undefined;
        return "";
      }
      return fence ? "" : line;
    })
    .join("\n");
};

export const parseMetadata = (source) => {
  const fields = new Map();
  for (const line of source.split("\n")) {
    const normalized = line
      .trim()
      .replace(/^[-*+]\s+/, "")
      .replaceAll("**", "")
      .trim();
    const match = normalized.match(
      /^(Task\s+ID|Task|Status|Implementation|Verification)\s*:\s*(.*?)\s*$/i,
    );
    if (!match) continue;
    const key = match[1].toLowerCase().replace(/\s+/g, "_");
    const val = match[2].trim().replaceAll("`", "").trim();
    const values = fields.get(key) ?? [];
    values.push(val);
    fields.set(key, values);
  }
  return fields;
};

export const taskIdFromFilename = (file) =>
  path.basename(file).match(/^([A-Z]+-\d+)-/)?.[1];

export const section = (source, heading) => {
  const expression = new RegExp(
    `^##\\s+(?:\\d+\\.\\s+)?${heading}\\s*$`,
    "gim",
  );
  const matches = [...source.matchAll(expression)];
  if (matches.length !== 1) return { count: matches.length, source: "" };
  const start = matches[0].index + matches[0][0].length;
  const remainder = source.slice(start);
  const nextHeading = remainder.search(/^##\s+/m);
  return {
    count: 1,
    source: nextHeading === -1 ? remainder : remainder.slice(0, nextHeading),
  };
};

export const tableCells = (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
};

export const validEvidenceDate = (value) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const validateEvidence = (relative, source, verification, failures) => {
  const evidence = section(source, "Evidence");
  if (evidence.count !== 1) {
    failures.push(
      `${relative} with Verification: ${verification} must contain exactly one canonical Evidence table under ## Evidence`,
    );
    return;
  }

  const lines = evidence.source.split("\n");
  const headerIndex = lines.findIndex((line) => {
    const cells = tableCells(line);
    return cells && JSON.stringify(cells) === JSON.stringify(evidenceHeaders);
  });
  if (headerIndex === -1) {
    failures.push(
      `${relative} Evidence table headers must be exactly: ${evidenceHeaders.join(", ")}`,
    );
    return;
  }

  const separator = tableCells(lines[headerIndex + 1] ?? "");
  if (
    !separator ||
    separator.length !== evidenceHeaders.length ||
    !separator.every((cell) => /^:?-{3,}:?$/.test(cell))
  ) {
    failures.push(`${relative} has an invalid Evidence table separator row`);
    return;
  }

  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    const cells = tableCells(line);
    if (!cells) {
      if (line.trim()) break;
      if (rows.length > 0) break;
      continue;
    }
    rows.push(cells);
  }
  if (rows.length === 0) {
    failures.push(
      `${relative} Evidence table must contain at least one data row`,
    );
    return;
  }

  let passRows = 0;
  rows.forEach((cells, index) => {
    const row = index + 1;
    if (cells.length !== evidenceHeaders.length) {
      failures.push(`${relative} Evidence row ${row} must contain four cells`);
      return;
    }
    const [claim, reference, date, result] = cells;
    if (!claim)
      failures.push(
        `${relative} Evidence row ${row} requires a non-empty Claim`,
      );
    if (!reference)
      failures.push(
        `${relative} Evidence row ${row} requires non-empty Evidence`,
      );
    if (!date) {
      failures.push(
        `${relative} Evidence row ${row} requires a non-empty Date`,
      );
    } else if (!validEvidenceDate(date)) {
      failures.push(
        `${relative} has invalid Evidence date in row ${row}: ${date}`,
      );
    }
    if (result !== "PASS" && result !== "FAIL") {
      failures.push(
        `${relative} has invalid Evidence result in row ${row}: ${result}`,
      );
    } else if (
      result === "PASS" &&
      claim &&
      reference &&
      validEvidenceDate(date)
    ) {
      passRows += 1;
    }
  });

  if (
    (verification === "VERIFIED" || verification === "PARTIALLY VERIFIED") &&
    passRows === 0
  ) {
    failures.push(
      `${relative} with Verification: ${verification} requires at least one PASS Evidence row`,
    );
  }
};

export const parseLabeledBlocks = (source) => {
  const blocks = new Map();
  let currentKey = null;
  const currentLines = [];

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(
      /^(?:#{1,4}\s+|[-*+]\s+)?(?:\*\*)?(Changed facts|Canonical owners|Documentation verification|Reason)(?:\*\*)?:?\s*(.*)$/i,
    );
    if (headingMatch) {
      if (currentKey) {
        blocks.set(currentKey, currentLines.join("\n").trim());
      }
      currentKey = headingMatch[1].toLowerCase();
      currentLines.length = 0;
      if (headingMatch[2]) {
        currentLines.push(headingMatch[2].trim());
      }
    } else if (currentKey) {
      currentLines.push(line);
    }
  }
  if (currentKey) {
    blocks.set(currentKey, currentLines.join("\n").trim());
  }
  return blocks;
};

export const validateDocumentationImpactSection = (
  relative,
  source,
  failures,
) => {
  const headings = [
    ...source.matchAll(/^##\s+(?:\d+\.\s+)?Documentation Impact\s*$/gim),
  ];
  if (headings.length !== 1) {
    failures.push(
      `${relative} must contain exactly one Documentation Impact section`,
    );
    return false;
  }

  const impactSection = section(source, "Documentation Impact");
  const sectionContent = impactSection.source;

  const declarations = [
    ...sectionContent.matchAll(
      /^\s*(?:[-*+]\s+)?(?:\*\*)?Documentation Impact(?:\*\*)?:\s*(\S.*?)\s*$/gim,
    ),
  ].map((match) => match[1].replace(/\*\*/g, "").trim());

  if (declarations.length !== 1) {
    failures.push(
      `${relative} must declare exactly one Documentation Impact value (REQUIRED or NONE)`,
    );
    return false;
  }

  const declaration = declarations[0];
  if (declaration !== "REQUIRED" && declaration !== "NONE") {
    failures.push(
      `${relative} has invalid Documentation Impact declaration: ${declaration}`,
    );
    return false;
  }

  const blocks = parseLabeledBlocks(sectionContent);
  if (declaration === "NONE") {
    const reason = blocks.get("reason");
    if (!reason) {
      failures.push(
        `${relative} with Documentation Impact: NONE requires a non-empty Reason`,
      );
    }
  } else if (declaration === "REQUIRED") {
    const changedFacts = blocks.get("changed facts");
    const canonicalOwners = blocks.get("canonical owners");
    const docVerification = blocks.get("documentation verification");

    if (!changedFacts) {
      failures.push(
        `${relative} with Documentation Impact: REQUIRED requires non-empty Changed facts`,
      );
    }
    if (!canonicalOwners) {
      failures.push(
        `${relative} with Documentation Impact: REQUIRED requires non-empty Canonical owners`,
      );
    }
    if (!docVerification) {
      failures.push(
        `${relative} with Documentation Impact: REQUIRED requires non-empty Documentation verification`,
      );
    }
  }
  return true;
};

export const checkTaskDirectory = async (
  root,
  relativeDirectory,
  allowedStatuses,
  historicalTasks,
  failures,
) => {
  const directory = path.join(root, relativeDirectory);
  if (!(await exists(directory)) || !(await stat(directory)).isDirectory())
    return [];

  const files = await markdownFiles(directory);
  for (const file of files) {
    const source = withoutFencedCode(await readFile(file, "utf8"));
    const relative = path.relative(root, file);
    const taskId = taskIdFromFilename(file);

    if (historicalTasks.has(taskId)) {
      // Historical task compatibility: preserve historical records without enforcing new schema
      continue;
    }

    const metadata = parseMetadata(source);
    const statuses = metadata.get("status") ?? metadata.get("task") ?? [];
    if (statuses.length !== 1) {
      failures.push(
        `${relative} must declare exactly one Task Status lifecycle value`,
      );
    } else if (!allowedStatuses.has(statuses[0].trim())) {
      failures.push(
        `${relative} has invalid task status for directory ${relativeDirectory}: ${statuses[0].trim()}`,
      );
    }

    validateDocumentationImpactSection(relative, source, failures);

    const verifications = metadata.get("verification") ?? [];
    if (verifications.length > 1) {
      failures.push(`${relative} must declare at most one Verification value`);
    } else if (verifications.length === 1) {
      const verification = verifications[0];
      if (!verificationValues.has(verification)) {
        failures.push(
          `${relative} has invalid Verification value: ${verification}`,
        );
      } else {
        validateEvidence(relative, source, verification, failures);
      }
    }
  }
  return files;
};

export async function checkDocumentation(
  root,
  { historicalTasks = HISTORICAL_TASKS } = {},
) {
  const failures = [];

  // 1. Required entry points
  for (const relative of requiredEntryPoints) {
    if (!(await exists(path.join(root, relative)))) {
      failures.push(
        `Required documentation entry point is missing: ${relative}`,
      );
    }
  }

  // 2. Relative Markdown link checks
  const docsDirectory = path.join(root, "docs");
  const filesToCheck = [
    path.join(root, "README.md"),
    path.join(root, "AGENTS.md"),
    ...(await markdownFiles(docsDirectory)),
  ];

  for (const file of filesToCheck) {
    if (!(await exists(file))) continue;
    const source = withoutFencedCode(await readFile(file, "utf8"));
    for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim();
      if (target.startsWith("<")) target = target.slice(1, target.indexOf(">"));
      else target = target.split(/\s+["']/)[0];
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      target = decodeURIComponent(target.split("#")[0].split("?")[0]);
      if (!target) continue;
      const resolved = path.resolve(path.dirname(file), target);
      const relative = path.relative(root, file);
      if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
        failures.push(`${relative} links outside the repository: ${target}`);
      } else if (!(await exists(resolved))) {
        failures.push(`${relative} has unresolved link: ${target}`);
      }
    }
  }

  // 3. Task directory governance
  await checkTaskDirectory(
    root,
    "docs/tasks/active",
    new Set(["PLANNED", "IN PROGRESS", "VERIFICATION PENDING"]),
    historicalTasks,
    failures,
  );
  await checkTaskDirectory(
    root,
    "docs/tasks/completed",
    new Set(["COMPLETED"]),
    historicalTasks,
    failures,
  );

  return failures;
}
