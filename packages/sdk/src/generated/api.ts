// Generated. Do not edit.
export interface paths {
    "/api/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_ready"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Xác thực danh tính và thiết lập phiên làm việc */
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kiểm tra phiên làm việc hiện tại */
        get: operations["AuthController_getSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hủy bỏ phiên làm việc và xóa cookie */
        post: operations["AuthController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        LiveDto: {
            /** @enum {string} */
            status: "ok";
        };
        ChecksDto: {
            database: boolean;
            storage: boolean;
        };
        ReadyDto: {
            /** @enum {string} */
            status: "ok" | "unavailable";
            checks: components["schemas"]["ChecksDto"];
        };
        ReadyErrorDto: {
            /** @enum {string} */
            status: "ok" | "unavailable";
            checks: components["schemas"]["ChecksDto"];
            code: string;
            message: string;
            requestId: string;
        };
        LoginRequestDto: {
            /**
             * @description Tên đăng nhập
             * @example admin
             */
            username: string;
            /**
             * @description Mật khẩu
             * @example secret123
             */
            password: string;
        };
        UserDto: {
            /** @description Mã định danh người dùng */
            id: string;
            /** @description Tên đăng nhập */
            username: string;
        };
        LoginResponseDto: {
            user: components["schemas"]["UserDto"];
        };
        SessionResponseDto: {
            /**
             * @description Trạng thái xác thực
             * @example true
             */
            authenticated: boolean;
            user: components["schemas"]["UserDto"];
        };
        LogoutResponseDto: {
            /**
             * @description Kết quả đăng xuất
             * @example true
             */
            success: boolean;
        };
        ApiErrorDto: {
            code: string;
            message: string;
            requestId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_live: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LiveDto"];
                };
            };
        };
    };
    HealthController_ready: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadyDto"];
                };
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadyErrorDto"];
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequestDto"];
            };
        };
        responses: {
            /** @description Đăng nhập thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponseDto"];
                };
            };
            /** @description Yêu cầu không hợp lệ hoặc thiếu thông tin */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Thông tin xác thực không chính xác */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Origin không hợp lệ hoặc không được phép */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Quá nhiều lần đăng nhập thất bại */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_getSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Phiên làm việc hợp lệ */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionResponseDto"];
                };
            };
            /** @description Chưa đăng nhập hoặc phiên đã hết hạn */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Đăng xuất thành công */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutResponseDto"];
                };
            };
            /** @description Origin không hợp lệ hoặc không được phép */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
