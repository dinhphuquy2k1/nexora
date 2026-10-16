import { RuleTester, ESLint } from "eslint";
import ts from "typescript-eslint";
import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import rule from "./no-domain-vocabulary-literals.mjs";
const filename = resolve("apps/api/src/carrier/application/lint-example.ts");
const message = (constant) => ({ messageId: "canonical", data: { constant } });
RuleTester.describe = describe;
RuleTester.it = it;
new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  "no-domain-vocabulary-literals",
  rule,
  {
    valid: [
      "const event={eventType:CarrierAuditType.CONNECT,outcome:CarrierAuditOutcome.SUCCESS,reason:CarrierAuditReason.VERIFIED};",
      'export const CarrierAuditOutcome={SUCCESS:"SUCCESS"} as const;',
      'const unrelated={message:"PASSWORD_DECRYPT",code:"IDENTITY_MISMATCH"};',

      "if(user.status!==UserStatus.ACTIVE){}",
      "const data={status:ConnectionStatus.REAUTH_REQUIRED,role:UserRole.ADMIN,provider:CarrierProvider.UNISHIP,secretType:SecretType.PASSWORD};",
      'export const UserStatus={ACTIVE:"ACTIVE",DISABLED:"DISABLED"} as const;',
      'export const UserRole={ADMIN:"ADMIN",OPERATOR:"OPERATOR"} as const;',
      'export const ConnectionStatus={ERROR:"ERROR",CONNECTED:"CONNECTED",REAUTH_REQUIRED:"REAUTH_REQUIRED"} as const;',
      'export const CarrierProvider={UNISHIP:"uniship"} as const;',
      'export const SecretType={PASSWORD:"PASSWORD",ACCESS_TOKEN:"ACCESS_TOKEN",REFRESH_TOKEN:"REFRESH_TOKEN"} as const;',
      'throw new CarrierError("UNAUTHORIZED");',
      'const error={code:"ERROR",message:"ACTIVE",status:500};',
      'const connection={transport:{status:"ERROR"}};',
      'const transport={status:"ERROR"}; if(transport.status==="ERROR"){}',
      'const label="ACTIVE"; display("ADMIN"); route("uniship");',
      'type Status="ACTIVE"|"DISABLED"; interface User {status:"ACTIVE";role:"ADMIN";}',
      'const unrelated={provider:"aws",role:"button",status:"loading",secretType:"label"};',
      'const route={path:"/api/carriers",error:"UNAUTHORIZED"};',
      'const unknown={status:"toString"}; const constructor="name";',
      'const status="dynamic-key"; user[status]="ACTIVE"; const data={[status]:"ACTIVE"};',
      'const crypto={purpose:"CARRIER_PASSWORD"};',
    ].map((code) => ({ code, filename })),
    invalid: [
      [
        'const event={eventType:"PASSWORD_DECRYPT"};',
        "CarrierAuditType.PASSWORD_DECRYPT",
      ],
      ['const event={event_type:"RECOVERY"};', "CarrierAuditType.RECOVERY"],
      ['if(event.outcome === "ALLOWED") {}', "CarrierAuditOutcome.ALLOWED"],
      [
        'const event={reason:"INVALID_CREDENTIALS"};',
        "CarrierAuditReason.INVALID_CREDENTIALS",
      ],

      ['if(user.status!=="ACTIVE"){}', "UserStatus.ACTIVE"],
      ['if(status!=="ACTIVE"){}', "UserStatus.ACTIVE"],
      [
        'const data={status:"REAUTH_REQUIRED"};',
        "ConnectionStatus.REAUTH_REQUIRED",
      ],
      ['if(user.role==="ADMIN"){}', "UserRole.ADMIN"],
      [
        'const result={carriers:[{provider:"uniship"}]};',
        "CarrierProvider.UNISHIP",
      ],
      [
        'await prisma.user.update({where:{id},data:{status:"DISABLED"}});',
        "UserStatus.DISABLED",
      ],
      [
        'const data={credential:{create:{secret_type:"ACCESS_TOKEN"}}};',
        "SecretType.ACCESS_TOKEN",
      ],
      ['user["status"]="ACTIVE";', "UserStatus.ACTIVE"],
      ['let status="DISABLED";', "UserStatus.DISABLED"],
      ['if("OPERATOR"===user.role){}', "UserRole.OPERATOR"],
      [
        'const data={status:("CONNECTED" as string)};',
        "ConnectionStatus.CONNECTED",
      ],
      [
        'const data={status:("CONNECTED" satisfies string)};',
        "ConnectionStatus.CONNECTED",
      ],
      ["const data={status:`CONNECTED`};", "ConnectionStatus.CONNECTED"],
      [
        'const data={status:flag?"ACTIVE":UserStatus.DISABLED};',
        "UserStatus.ACTIVE",
      ],
      [
        'const query={where:{status:{in:["DISABLED"]}}};',
        "UserStatus.DISABLED",
      ],
      ['const bad={status:"ACTIVE"} as const;', "UserStatus.ACTIVE"],
      ['if("ERROR"===connection.status){}', "ConnectionStatus.ERROR"],
      ['const connection={status:"ERROR"};', "ConnectionStatus.ERROR"],
      ['connection.status="ERROR";', "ConnectionStatus.ERROR"],
      [
        'connection.status=flag?"ERROR":ConnectionStatus.CONNECTED;',
        "ConnectionStatus.ERROR",
      ],
      [
        'await db.carrierConnection.update({data:{status:"ERROR"}});',
        "ConnectionStatus.ERROR",
      ],
      ['["ACTIVE"].includes(user.status);', "UserStatus.ACTIVE"],
    ].map(([code, constant]) => ({
      code,
      filename,
      errors: [message(constant)],
    })),
  },
);
test("actual ESLint config enables error guard only on production Identity/Carrier", async () => {
  const eslint = new ESLint();
  const code = 'export const data={status:"ACTIVE"};';
  for (const filePath of [
    "apps/api/src/identity/infrastructure/probe.ts",
    "apps/api/src/carrier/application/probe.ts",
  ]) {
    const [r] = await eslint.lintText(code, { filePath });
    const errors = r.messages.filter(
      (m) => m.ruleId === "nexora/no-domain-vocabulary-literals",
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0].severity, 2);
  }
  for (const filePath of [
    "apps/api/test/fixture.ts",
    "apps/api/src/carrier/test/fixture.ts",
    "apps/api/src/identity/example.test.ts",
    "apps/api/src/carrier/generated/example.ts",
    "apps/api/src/identity/example.d.ts",
    "packages/sdk/src/generated/api.ts",
    "apps/api/openapi/openapi.json",
    "docs/example.md",
    "apps/api/src/common/crypto/example.ts",
  ]) {
    const [r] = await eslint.lintText(code, { filePath, warnIgnored: false });
    assert.ok(
      !r?.messages.some(
        (m) => m.ruleId === "nexora/no-domain-vocabulary-literals",
      ),
    );
  }
});
test("real ESLint CLI rejects a production violation, then accepts canonical constant", async () => {
  const path = resolve(
    "apps/api/src/carrier/application/__lint_probe_" + process.pid + ".ts",
  );
  const cli = resolve("node_modules/eslint/bin/eslint.js");
  let owned = false;
  try {
    await writeFile(path, 'export const data={status:"REAUTH_REQUIRED"};\n', {
      flag: "wx",
    });
    owned = true;
    const bad = spawnSync(process.execPath, [cli, path, "--format", "json"], {
      encoding: "utf8",
    });
    assert.equal(bad.status, 1);
    assert.ok(
      JSON.parse(bad.stdout)[0].messages.some(
        (m) => m.ruleId === "nexora/no-domain-vocabulary-literals",
      ),
    );
    await writeFile(
      path,
      'import { ConnectionStatus } from "../domain/carrier";\nexport const data={status:ConnectionStatus.REAUTH_REQUIRED};\n',
    );
    execFileSync(process.execPath, [cli, path], { stdio: "pipe" });
  } finally {
    if (owned) await unlink(path);
  }
});

test("guard catalog covers every canonical owning-domain value", async () => {
  const { default: typescript } = await import("typescript");
  const { readFile } = await import("node:fs/promises");
  const eslint = new ESLint();
  for (const [path, objects] of [
    ["identity/domain/session-assurance.ts", { AuthLevel: "authLevel" }],
    [
      "identity/domain/user-policy.ts",
      { UserStatus: "status", UserRole: "role" },
    ],
    [
      "carrier/domain/security-audit.ts",
      {
        CarrierAuditType: "eventType",
        CarrierAuditOutcome: "outcome",
        CarrierAuditReason: "reason",
      },
    ],
    [
      "carrier/domain/carrier.ts",
      {
        ConnectionStatus: "status",
        CarrierProvider: "provider",
        SecretType: "secretType",
      },
    ],
  ]) {
    const source = typescript.createSourceFile(
      path,
      await readFile("apps/api/src/" + path, "utf8"),
      typescript.ScriptTarget.Latest,
      true,
    );
    const definitions = [];
    for (const statement of source.statements) {
      if (!typescript.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const owner = declaration.name.getText(source),
          field = objects[owner];
        if (!field) continue;
        let object = declaration.initializer;
        if (typescript.isAsExpression(object)) object = object.expression;
        assert.ok(typescript.isObjectLiteralExpression(object));
        for (const property of object.properties) {
          assert.ok(
            typescript.isPropertyAssignment(property) &&
              typescript.isStringLiteral(property.initializer),
          );
          definitions.push({
            owner,
            field,
            key: property.name.getText(source),
            value: property.initializer.text,
          });
        }
      }
    }
    assert.ok(definitions.length > 0);
    for (const { owner, field, key, value } of definitions) {
      const [result] = await eslint.lintText(
        `export const connection={${field}:${JSON.stringify(value)}};`,
        { filePath: filename },
      );
      const errors = result.messages.filter(
        (m) => m.ruleId === "nexora/no-domain-vocabulary-literals",
      );
      assert.equal(errors.length, 1, `${owner}.${key} must be enforced`);
      assert.ok(errors[0].message.includes(owner + "." + key));
    }
  }
});
