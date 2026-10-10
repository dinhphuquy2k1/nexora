import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule, CONFIG } from "./app.module";
import type { Config } from "./config";
import { configure, document } from "./http";
async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configure(app);
  const c = app.get<Config>(CONFIG);
  if (c.API_DOCS_ENABLED === "true")
    SwaggerModule.setup("api/docs", app, document(app));
  await app.listen(c.PORT, "0.0.0.0");
  console.log(
    JSON.stringify({ level: "info", event: "started", port: c.PORT }),
  );
}
main().catch(() => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup_failed",
      message: "Check configuration and service availability",
    }),
  );
  process.exitCode = 1;
});
