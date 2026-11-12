// Test-only migration of legacy direct port injection to explicit static bindings.
// Every operation still uses the real SyncRepository and its actual transaction/fences.
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncJobExecutor,
} = require("../../dist/sync/application/sync-job-executor.service");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const {
  createCustomerSyncBinding,
} = require("../../dist/customer/infrastructure/customer-sync-domain.binding");
const { SyncType } = require("../../dist/sync/domain/sync.constants");
const contexts = new WeakMap();
function testCapabilities(provider, processor, providerName = "uniship") {
  const domain = createCustomerSyncBinding(processor);
  return new SyncCapabilityRegistry(
    Object.values(SyncType).map((type) => ({
      providerName,
      type,
      provider,
      domain,
    })),
  );
}
function testRepository(url, config, provider, processor, locks = "exclusive") {
  const repository = new SyncRepository(
    url,
    config,
    testCapabilities(provider, processor),
    locks,
  );
  contexts.set(repository, { url, config, provider, processor, locks });
  return repository;
}
async function applyWithProcessor(repository, job, processor) {
  const context = contexts.get(repository);
  if (!processor || processor === context.processor)
    return repository.apply(job);
  const bound = testRepository(
    context.url,
    context.config,
    context.provider,
    processor,
    context.locks,
  );
  try {
    return await bound.apply(job);
  } finally {
    await bound.close();
  }
}
function testExecutor(repository, provider, processor, pageTimeoutMs) {
  const context = contexts.get(repository);
  if (provider === context.provider && processor === context.processor)
    return new SyncJobExecutor(repository, pageTimeoutMs);
  // A new fixture capability is a new immutable registry, never runtime mutation.
  return {
    async execute(...args) {
      const bound = testRepository(
        context.url,
        context.config,
        provider,
        processor,
        context.locks,
      );
      try {
        return await new SyncJobExecutor(bound, pageTimeoutMs).execute(...args);
      } finally {
        await bound.close();
      }
    },
  };
}
module.exports = {
  testCapabilities,
  testRepository,
  applyWithProcessor,
  testExecutor,
};
