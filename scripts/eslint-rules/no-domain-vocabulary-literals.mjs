// Tooling vocabulary catalog; canonical runtime definitions stay in their domains.
const fields = {
  eventType: {
    PASSWORD_DECRYPT: "CarrierAuditType.PASSWORD_DECRYPT",
    CONNECT: "CarrierAuditType.CONNECT",
    RECONNECT: "CarrierAuditType.RECONNECT",
    RECOVERY: "CarrierAuditType.RECOVERY",
  },
  outcome: {
    ALLOWED: "CarrierAuditOutcome.ALLOWED",
    SUCCESS: "CarrierAuditOutcome.SUCCESS",
    FAILURE: "CarrierAuditOutcome.FAILURE",
  },
  reason: {
    RECOVERY_REQUESTED: "CarrierAuditReason.RECOVERY_REQUESTED",
    VERIFIED: "CarrierAuditReason.VERIFIED",
    INVALID_CREDENTIALS: "CarrierAuditReason.INVALID_CREDENTIALS",
    DUPLICATE_ACCOUNT: "CarrierAuditReason.DUPLICATE_ACCOUNT",
    IDENTITY_MISMATCH: "CarrierAuditReason.IDENTITY_MISMATCH",
    UNAVAILABLE: "CarrierAuditReason.UNAVAILABLE",
  },
  status: {
    ACTIVE: "UserStatus.ACTIVE",
    DISABLED: "UserStatus.DISABLED",
    CONNECTED: "ConnectionStatus.CONNECTED",
    REAUTH_REQUIRED: "ConnectionStatus.REAUTH_REQUIRED",
    ERROR: "ConnectionStatus.ERROR",
  },
  role: { ADMIN: "UserRole.ADMIN", OPERATOR: "UserRole.OPERATOR" },
  provider: { uniship: "CarrierProvider.UNISHIP" },
  secretType: {
    ACCESS_TOKEN: "SecretType.ACCESS_TOKEN",
    REFRESH_TOKEN: "SecretType.REFRESH_TOKEN",
    PASSWORD: "SecretType.PASSWORD",
  },
};
const wrappers = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "ChainExpression",
]);
function unwrap(node) {
  while (node && wrappers.has(node.type)) node = node.expression;
  return node;
}
function name(node) {
  node = unwrap(node);
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "Literal" && typeof node.value === "string")
    return node.value;
}
function field(node) {
  node = unwrap(node);
  if (node?.type === "MemberExpression") {
    if (node.computed && node.property.type !== "Literal") return undefined;
    return name(node.property);
  }
  return name(node);
}
function normalize(value) {
  if (value === "secret_type") return "secretType";
  if (value === "event_type") return "eventType";
  return value;
}
function connectionContext(node) {
  // ERROR alone is ambiguous (transport/logging may have the same status).
  let statusOwner;
  for (let n = node; n; n = n.parent) {
    if (n.type === "Property" && name(n.key) === "status")
      statusOwner = n.parent;
    const operands = [n];
    if (n.type === "BinaryExpression" || n.type === "AssignmentExpression")
      operands.push(unwrap(n.left), unwrap(n.right));
    if (
      operands.some(
        (operand) =>
          operand?.type === "MemberExpression" &&
          field(operand) === "status" &&
          ["connection", "carrierConnection"].includes(name(operand.object)),
      )
    )
      return true;
    if (n.type === "CallExpression") {
      let callee = unwrap(n.callee);
      while (callee?.type === "MemberExpression") {
        if (name(callee.property) === "carrierConnection") return true;
        callee = unwrap(callee.object);
      }
    }
    if (
      n.type === "VariableDeclarator" &&
      ["connection", "carrierConnection"].includes(name(n.id)) &&
      statusOwner === unwrap(n.init)
    )
      return true;
  }
  return false;
}
function contextField(node) {
  let current = node;
  while (current.parent) {
    const p = current.parent;
    if (
      wrappers.has(p.type) ||
      p.type === "ArrayExpression" ||
      (p.type === "ConditionalExpression" && p.test !== current)
    ) {
      current = p;
      continue;
    }
    if (p.type === "Property" && p.value === current) {
      if (p.computed && p.key.type !== "Literal") return undefined;
      const key = normalize(name(p.key));
      if (Object.hasOwn(fields, key)) return key;
      if (["in", "notIn", "equals", "not"].includes(key)) {
        current = p.parent;
        continue;
      }
      return undefined;
    }
    if (p.type === "VariableDeclarator" && p.init === current)
      return normalize(field(p.id));
    if (p.type === "AssignmentExpression" && p.right === current)
      return normalize(field(p.left));
    if (
      p.type === "BinaryExpression" &&
      ["===", "!==", "==", "!=", "<", ">", "<=", ">="].includes(p.operator)
    )
      return normalize(field(p.left === current ? p.right : p.left));
    // Literal arrays checked with includes against a known persisted field.
    if (
      p.type === "MemberExpression" &&
      p.object === current &&
      name(p.property) === "includes"
    ) {
      const call = p.parent;
      if (call?.type === "CallExpression")
        return normalize(field(call.arguments[0]));
    }
    return undefined;
  }
}
export default {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      canonical: "Use {{constant}} instead of this persisted domain literal.",
    },
  },
  create(context) {
    function check(node, value) {
      if (typeof value !== "string") return;
      const key = contextField(node);
      if (!Object.hasOwn(fields, key) || !Object.hasOwn(fields[key], value))
        return;
      const constant = fields[key][value];
      if (!constant) return;
      if (value === "ERROR" && !connectionContext(node)) return;
      context.report({ node, messageId: "canonical", data: { constant } });
    }
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0)
          check(node, node.quasis[0].value.cooked);
      },
    };
  },
};
