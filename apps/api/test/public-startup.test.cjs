require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verifyPublicStartup } = require("../dist/public-startup");
const { AdminGuard } = require("../dist/identity/presentation/admin.guard");
const { SessionGuard } = require("../dist/identity/presentation/session.guard");
const {
  AdminBoundaryGuard,
} = require("../dist/identity/presentation/admin-boundary.guard");
const { Reflector } = require("@nestjs/core");
const { MfaPort } = require("../dist/identity/application/mfa.port");
test("public gate checks registered enforcement, assurance and readiness; local is independent", async () => {
  const admin = new AdminGuard({}),
    session = new SessionGuard({}, new Reflector()),
    boundary = new AdminBoundaryGuard(admin);
  let checked = 0;
  const instances = new Map([
    [AdminGuard, admin],
    [SessionGuard, session],
    [AdminBoundaryGuard, boundary],
    [
      MfaPort,
      {
        assertPublicReady: async () => {
          checked++;
        },
      },
    ],
  ]);
  const app = {
    get: (key) => instances.get(key),
    config: { getGlobalGuards: () => [session, boundary] },
  };
  await verifyPublicStartup(app, { deployment: { profile: "LOCAL" } });
  assert.equal(checked, 0);
  await verifyPublicStartup(app, { deployment: { profile: "PUBLIC_HTTPS" } });
  assert.equal(checked, 1);
  app.config.getGlobalGuards = () => [session];
  await assert.rejects(
    verifyPublicStartup(app, { deployment: { profile: "PUBLIC_HTTPS" } }),
  );
  assert.equal(checked, 1);
  app.config.getGlobalGuards = () => [session, boundary];
  instances.set(MfaPort, {
    assertPublicReady: async () => {
      throw Error("fixture readiness failure");
    },
  });
  await assert.rejects(
    verifyPublicStartup(app, { deployment: { profile: "PUBLIC_HTTPS" } }),
  );
});
