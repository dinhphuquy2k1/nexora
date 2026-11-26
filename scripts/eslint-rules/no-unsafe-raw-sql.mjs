const UNSAFE_METHODS = new Set(["$queryRawUnsafe", "$executeRawUnsafe"]);

function getMethodName(callee) {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed) {
    return callee.property?.type === "Identifier" ? callee.property.name : null;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow $queryRawUnsafe and $executeRawUnsafe in production source code",
    },
    schema: [],
    messages: {
      unsafeRawSql:
        "Do not use {{method}} in production code; use parameterized $queryRaw/$executeRaw or Prisma.sql.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = getMethodName(node.callee);
        if (name && UNSAFE_METHODS.has(name)) {
          context.report({
            node,
            messageId: "unsafeRawSql",
            data: { method: name },
          });
        }
      },
      TaggedTemplateExpression(node) {
        const name = getMethodName(node.tag);
        if (name && UNSAFE_METHODS.has(name)) {
          context.report({
            node,
            messageId: "unsafeRawSql",
            data: { method: name },
          });
        }
      },
    };
  },
};
