const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpStatus,
} = require("@nestjs/common");
const { configure } = require("../dist/http");

// Exercise the actual registered filter without exporting implementation details.
let filter;
configure({
  getHttpAdapter: () => undefined,
  setGlobalPrefix() {},
  useGlobalFilters(value) {
    filter = value;
  },
  use() {},
  enableShutdownHooks() {},
});

const cases = [
  [
    "400",
    new BadRequestException(),
    400,
    "VALIDATION_ERROR",
    "Yêu cầu không hợp lệ",
  ],
  [
    "401",
    new UnauthorizedException(),
    401,
    "UNAUTHORIZED",
    "Chưa đăng nhập hoặc phiên đã hết hạn",
  ],
  [
    "403",
    new ForbiddenException(),
    403,
    "FORBIDDEN",
    "Không có quyền truy cập",
  ],
  ["404", new NotFoundException(), 404, "NOT_FOUND", "Không tìm thấy endpoint"],
  [
    "429",
    new HttpException({}, HttpStatus.TOO_MANY_REQUESTS),
    429,
    "TOO_MANY_REQUESTS",
    "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
  ],
  [
    "unexpected error is sanitized",
    new Error("private database diagnostic"),
    500,
    "INTERNAL_ERROR",
    "Lỗi hệ thống",
  ],
  [
    "unknown status",
    new HttpException({}, 418),
    418,
    "INTERNAL_ERROR",
    "Lỗi hệ thống",
  ],
  [
    "custom fields",
    new HttpException({ code: "CUSTOM", message: "Approved message" }, 401),
    401,
    "CUSTOM",
    "Approved message",
  ],
  [
    "code only",
    new HttpException({ code: "CUSTOM" }, 401),
    401,
    "CUSTOM",
    "Chưa đăng nhập hoặc phiên đã hết hạn",
  ],
  [
    "message only",
    new HttpException({ message: "private diagnostic" }, 401),
    401,
    "UNAUTHORIZED",
    "Chưa đăng nhập hoặc phiên đã hết hạn",
  ],
  [
    "404 custom fields",
    new HttpException({ code: "CUSTOM", message: "private path" }, 404),
    404,
    "CUSTOM",
    "Không tìm thấy endpoint",
  ],
  [
    "404 message only",
    new HttpException({ message: "private path" }, 404),
    404,
    "NOT_FOUND",
    "Không tìm thấy endpoint",
  ],
  [
    "string response",
    new HttpException("private diagnostic", 403),
    403,
    "FORBIDDEN",
    "Không có quyền truy cập",
  ],
  [
    "non-string code",
    new HttpException({ code: 123, message: "private diagnostic" }, 400),
    400,
    "VALIDATION_ERROR",
    "Yêu cầu không hợp lệ",
  ],
  [
    "non-string message",
    new HttpException({ code: "CUSTOM", message: ["private diagnostic"] }, 400),
    400,
    "CUSTOM",
    "Yêu cầu không hợp lệ",
  ],
  [
    "unknown status with custom fields",
    new HttpException({ code: "CUSTOM", message: "Approved message" }, 422),
    422,
    "CUSTOM",
    "Approved message",
  ],
];

for (const [name, error, status, code, message] of cases) {
  test(`HTTP filter preserves ${name}`, () => {
    for (const requestId of ["request-one", "request-two"]) {
      let actualStatus;
      let body;
      const response = {
        locals: { requestId },
        status(value) {
          actualStatus = value;
          return this;
        },
        json(value) {
          body = value;
        },
      };
      filter.catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      });
      assert.equal(actualStatus, status);
      assert.deepEqual(body, { code, message, requestId });
    }
  });
}
