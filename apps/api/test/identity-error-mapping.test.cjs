const { test } = require("node:test");
const assert = require("node:assert/strict");
const { HttpStatus } = require("@nestjs/common");
const {
  UserManagementService,
  mapIdentityError,
  IDENTITY_ERROR_MAP,
  DEFAULT_IDENTITY_ERROR,
} = require("../dist/identity/application/user-management.service");
const { AuthService } = require("../dist/identity/application/auth.service");
const { IdentityError } = require("../dist/identity/domain/identity-error");
const { UserStatus } = require("../dist/identity/domain/user-policy");

test("mapIdentityError maps all six canonical error codes with correct HttpStatus, message, and preserved code", () => {
  const cases = [
    {
      code: "NOT_FOUND",
      status: HttpStatus.NOT_FOUND,
      message: "Không thể thực hiện yêu cầu",
    },
    {
      code: "FORBIDDEN",
      status: HttpStatus.FORBIDDEN,
      message: "Không thể thực hiện yêu cầu",
    },
    {
      code: "LAST_ACTIVE_ADMIN",
      status: HttpStatus.CONFLICT,
      message: "Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng",
    },
    {
      code: "USERNAME_EXISTS",
      status: HttpStatus.CONFLICT,
      message: "Tên đăng nhập đã tồn tại",
    },
    {
      code: "OPERATOR_ALREADY_CONFIGURED",
      status: HttpStatus.BAD_REQUEST,
      message: "Tài khoản đã thiết lập mật khẩu",
    },
    {
      code: "INVALID_OR_EXPIRED_SETUP_TOKEN",
      status: HttpStatus.BAD_REQUEST,
      message: "Liên kết thiết lập không hợp lệ hoặc đã hết hạn",
    },
  ];

  for (const c of cases) {
    const error = new IdentityError(c.code);
    const httpException = mapIdentityError(error);

    assert.equal(
      httpException.getStatus(),
      c.status,
      `Status mismatch for code ${c.code}`,
    );
    assert.deepEqual(
      httpException.getResponse(),
      {
        code: c.code,
        message: c.message,
      },
      `Response payload mismatch for code ${c.code}`,
    );
  }
});

test("mapIdentityError falls back to HTTP 400 and generic message for unknown IdentityError codes while preserving original code", () => {
  const unknownCodes = [
    "UNKNOWN_ERROR",
    "CUSTOM_PROVIDER_ERROR",
    "UNMAPPED_FAILURE",
  ];

  for (const code of unknownCodes) {
    const error = new IdentityError(code);
    const httpException = mapIdentityError(error);

    assert.equal(httpException.getStatus(), HttpStatus.BAD_REQUEST);
    assert.deepEqual(httpException.getResponse(), {
      code,
      message: "Không thể thực hiện yêu cầu",
    });
  }
});

test("IDENTITY_ERROR_MAP contains exactly the canonical mapped error codes with valid HttpStatus and messages", () => {
  assert.equal(typeof IDENTITY_ERROR_MAP, "object");
  assert.equal(typeof DEFAULT_IDENTITY_ERROR, "object");
  assert.equal(DEFAULT_IDENTITY_ERROR.status, HttpStatus.BAD_REQUEST);
  assert.equal(DEFAULT_IDENTITY_ERROR.message, "Không thể thực hiện yêu cầu");

  const expectedKeys = [
    "NOT_FOUND",
    "FORBIDDEN",
    "LAST_ACTIVE_ADMIN",
    "USERNAME_EXISTS",
    "OPERATOR_ALREADY_CONFIGURED",
    "INVALID_OR_EXPIRED_SETUP_TOKEN",
  ];

  assert.deepEqual(Object.keys(IDENTITY_ERROR_MAP).sort(), expectedKeys.sort());
});

test("UserManagementService rethrows non-IdentityError untouched without converting to HttpException", async () => {
  const genericError = new Error("Database network socket closed");
  const typeError = new TypeError("Cannot read properties of undefined");
  const customError = { custom: "payload", status: 500 };

  const port = {
    listUsers: async () => {
      throw genericError;
    },
    setStatus: async () => {
      throw typeError;
    },
    createOperator: async () => {
      throw customError;
    },
    reissue: async () => {
      throw genericError;
    },
    consume: async () => {
      throw genericError;
    },
    hashPassword: async () => "hash",
  };

  const service = new UserManagementService(port, new AuthService({}), [
    "http://localhost:3001",
  ]);

  await assert.rejects(
    service.listUsers("admin-id"),
    (err) => err === genericError,
  );

  await assert.rejects(
    service.setStatus("admin-id", "a0000000-0000-0000-0000-000000000001", {
      status: UserStatus.DISABLED,
    }),
    (err) => err === typeError,
  );

  await assert.rejects(
    service.createOperator(
      "admin-id",
      { username: "newoperator" },
      "http://localhost:3001",
    ),
    (err) => err === customError,
  );

  await assert.rejects(
    service.reissue(
      "admin-id",
      "a0000000-0000-0000-0000-000000000001",
      "http://localhost:3001",
    ),
    (err) => err === genericError,
  );

  await assert.rejects(
    service.setupPassword({
      token: "a".repeat(64),
      password: "StrongPassword123!",
    }),
    (err) => err === genericError,
  );
});

test("UserManagementService catches IdentityError across all operations and maps through unified mapping", async () => {
  const errorScenarios = [
    {
      code: "NOT_FOUND",
      expectedStatus: HttpStatus.NOT_FOUND,
      expectedMessage: "Không thể thực hiện yêu cầu",
    },
    {
      code: "FORBIDDEN",
      expectedStatus: HttpStatus.FORBIDDEN,
      expectedMessage: "Không thể thực hiện yêu cầu",
    },
    {
      code: "LAST_ACTIVE_ADMIN",
      expectedStatus: HttpStatus.CONFLICT,
      expectedMessage:
        "Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng",
    },
    {
      code: "USERNAME_EXISTS",
      expectedStatus: HttpStatus.CONFLICT,
      expectedMessage: "Tên đăng nhập đã tồn tại",
    },
    {
      code: "OPERATOR_ALREADY_CONFIGURED",
      expectedStatus: HttpStatus.BAD_REQUEST,
      expectedMessage: "Tài khoản đã thiết lập mật khẩu",
    },
    {
      code: "INVALID_OR_EXPIRED_SETUP_TOKEN",
      expectedStatus: HttpStatus.BAD_REQUEST,
      expectedMessage: "Liên kết thiết lập không hợp lệ hoặc đã hết hạn",
    },
    {
      code: "UNEXPECTED_IDENTITY_CODE",
      expectedStatus: HttpStatus.BAD_REQUEST,
      expectedMessage: "Không thể thực hiện yêu cầu",
    },
  ];

  for (const scenario of errorScenarios) {
    const port = {
      listUsers: async () => {
        throw new IdentityError(scenario.code);
      },
      setStatus: async () => {
        throw new IdentityError(scenario.code);
      },
      createOperator: async () => {
        throw new IdentityError(scenario.code);
      },
      reissue: async () => {
        throw new IdentityError(scenario.code);
      },
      consume: async () => {
        throw new IdentityError(scenario.code);
      },
      hashPassword: async () => "hash",
    };

    const service = new UserManagementService(port, new AuthService({}), [
      "http://localhost:3001",
    ]);

    const assertMappedError = (err) => {
      assert.equal(err.getStatus(), scenario.expectedStatus);
      assert.deepEqual(err.getResponse(), {
        code: scenario.code,
        message: scenario.expectedMessage,
      });
      return true;
    };

    await assert.rejects(service.listUsers("admin-id"), assertMappedError);

    await assert.rejects(
      service.setStatus("admin-id", "a0000000-0000-0000-0000-000000000001", {
        status: UserStatus.DISABLED,
      }),
      assertMappedError,
    );

    await assert.rejects(
      service.createOperator(
        "admin-id",
        { username: "newoperator" },
        "http://localhost:3001",
      ),
      assertMappedError,
    );

    await assert.rejects(
      service.reissue(
        "admin-id",
        "a0000000-0000-0000-0000-000000000001",
        "http://localhost:3001",
      ),
      assertMappedError,
    );

    await assert.rejects(
      service.setupPassword({
        token: "a".repeat(64),
        password: "StrongPassword123!",
      }),
      assertMappedError,
    );
  }
});

test("UserManagementService happy paths remain fully functional without regression", async () => {
  const dummyUser = {
    id: "a0000000-0000-0000-0000-000000000002",
    username: "testuser",
    role: "OPERATOR",
    status: "ACTIVE",
    hasPassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const port = {
    listUsers: async () => [dummyUser],
    setStatus: async () => dummyUser,
    createOperator: async (_actorId, username) => ({
      id: dummyUser.id,
      username,
    }),
    reissue: async () => {},
    consume: async () => {},
    hashPassword: async () => "hashed-password",
  };

  const service = new UserManagementService(port, new AuthService({}), [
    "http://localhost:3001",
  ]);

  const listRes = await service.listUsers("admin-id");
  assert.deepEqual(listRes, { users: [dummyUser] });

  const statusRes = await service.setStatus(
    "admin-id",
    "a0000000-0000-0000-0000-000000000002",
    { status: UserStatus.ACTIVE },
  );
  assert.deepEqual(statusRes, { user: dummyUser });

  const createRes = await service.createOperator(
    "admin-id",
    { username: "newoperator" },
    "http://localhost:3001",
  );
  assert.equal(createRes.user.username, "newoperator");
  assert.match(createRes.setupUrl, /^http:\/\/localhost:3001\/setup#token=/);

  const reissueRes = await service.reissue(
    "admin-id",
    "a0000000-0000-0000-0000-000000000002",
    "http://localhost:3001",
  );
  assert.match(reissueRes.setupUrl, /^http:\/\/localhost:3001\/setup#token=/);

  const setupRes = await service.setupPassword({
    token: "c".repeat(64),
    password: "ValidStrongPassword123!",
  });
  assert.deepEqual(setupRes, { success: true });
});
