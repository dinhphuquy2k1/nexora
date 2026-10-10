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
}
