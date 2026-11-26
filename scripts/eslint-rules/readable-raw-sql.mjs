const MAX_LINE_LENGTH = 120;
const RAW_SQL_METHODS = new Set(["$queryRaw", "$executeRaw"]);
const CLAUSE_PATTERN =
  /\b(?:SELECT|FROM|WHERE|SET|VALUES|RETURNING|ON\s+CONFLICT|ORDER\s+BY|GROUP\s+BY|JOIN)\b/gi;

function isRawSqlTag(tag) {
  if (!tag) return false;
  if (tag.type === "Identifier") {
    return RAW_SQL_METHODS.has(tag.name);
  }
  if (tag.type === "MemberExpression" && !tag.computed) {
    const prop = tag.property?.type === "Identifier" ? tag.property.name : null;
    if (!prop) return false;
    if (RAW_SQL_METHODS.has(prop)) return true;
    return (
      tag.object?.type === "Identifier" &&
      tag.object.name === "Prisma" &&
      prop === "sql"
    );
  }
  return false;
}

function stripNonClauseTokens(line) {
  return line
    .replace(/\$\{[^}]*\}/g, "${}")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\bIS\s+(?:NOT\s+)?DISTINCT\s+FROM\b/gi, "IS_DISTINCT")
    .replace(/--.*$/, "");
}

export default {
  meta: {
    type: "layout",
    docs: {
      description:
        "Enforce multiline readable formatting for Prisma.sql, $queryRaw, and $executeRaw tagged templates",
    },
    schema: [],
    messages: {
      lineTooLong:
        "Raw SQL line exceeds {{max}} characters ({{length}}); break it across multiple lines.",
      multipleClausesOnLine:
        "Raw SQL line contains multiple SQL clauses ({{clauses}}); place each clause on its own line.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      TaggedTemplateExpression(node) {
        if (!isRawSqlTag(node.tag)) return;
        const text = sourceCode.getText(node.quasi);
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line.length > MAX_LINE_LENGTH) {
            context.report({
              node: node.quasi,
              messageId: "lineTooLong",
              data: {
                max: String(MAX_LINE_LENGTH),
                length: String(line.length),
              },
            });
            return;
          }
          const cleaned = stripNonClauseTokens(line);
          const matches = cleaned.match(CLAUSE_PATTERN);
          if (matches && matches.length >= 2) {
            context.report({
              node: node.quasi,
              messageId: "multipleClausesOnLine",
              data: { clauses: matches.join(", ") },
            });
            return;
          }
        }
      },
    };
  },
};
