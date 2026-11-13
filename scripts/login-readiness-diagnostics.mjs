// Pre-auth test-only counters. Never retain CDP URLs, bodies, headers or exceptions.
const SCRIPT_FAILURE_REASONS = {
  "net::ERR_ABORTED": "ABORTED",
  "net::ERR_CONNECTION_CLOSED": "CONNECTION_CLOSED",
  "net::ERR_CONNECTION_RESET": "CONNECTION_RESET",
  "net::ERR_EMPTY_RESPONSE": "EMPTY_RESPONSE",
  "net::ERR_HTTP2_PROTOCOL_ERROR": "HTTP2_PROTOCOL_ERROR",
  "net::ERR_TIMED_OUT": "TIMED_OUT",
  "net::ERR_CERT_AUTHORITY_INVALID": "CERTIFICATE",
  "net::ERR_CERT_COMMON_NAME_INVALID": "CERTIFICATE",
  "net::ERR_CERT_DATE_INVALID": "CERTIFICATE",
};

export function createLoginReadinessDiagnostics() {
  let active = true;
  const counts = {
    scriptResponses: 0,
    scriptHttpErrors: 0,
    scriptLoadFailures: 0,
    certificateFailures: 0,
    documentLoadFailures: 0,
    runtimeExceptions: 0,
    contextsCleared: 0,
    documentNavigations: 0,
    domContentEvents: 0,
    loadEvents: 0,
    evaluationFailures: 0,
    protocolFailures: 0,
  };
  const reasons = {
    ABORTED: 0,
    BLOCKED: 0,
    CERTIFICATE: 0,
    CONNECTION_CLOSED: 0,
    CONNECTION_RESET: 0,
    EMPTY_RESPONSE: 0,
    HTTP2_PROTOCOL_ERROR: 0,
    TIMED_OUT: 0,
    OTHER: 0,
  };
  let canceled = 0;
  const increment = (key) => {
    if (active) counts[key] = Math.min(10000, counts[key] + 1);
  };
  return {
    observe({ method, params = {} }) {
      if (!active) return;
      if (method === "Network.responseReceived" && params.type === "Script") {
        const status = params.response?.status;
        if (Number.isInteger(status) && status >= 100 && status <= 599) {
          increment("scriptResponses");
          if (status >= 400) increment("scriptHttpErrors");
        }
      }
      if (method === "Network.loadingFailed") {
        if (params.type === "Script") {
          increment("scriptLoadFailures");
          if (
            [
              "net::ERR_CERT_AUTHORITY_INVALID",
              "net::ERR_CERT_COMMON_NAME_INVALID",
              "net::ERR_CERT_DATE_INVALID",
            ].includes(params.errorText)
          )
            increment("certificateFailures");
          const reason = params.blockedReason
            ? "BLOCKED"
            : (SCRIPT_FAILURE_REASONS[params.errorText] ?? "OTHER");
          reasons[reason] = Math.min(10000, reasons[reason] + 1);
          if (params.canceled === true)
            canceled = Math.min(10000, canceled + 1);
        }
        if (params.type === "Document") increment("documentLoadFailures");
      }
      if (method === "Runtime.exceptionThrown") increment("runtimeExceptions");
      if (method === "Runtime.executionContextsCleared")
        increment("contextsCleared");
      if (method === "Page.frameNavigated") increment("documentNavigations");
      if (method === "Page.domContentEventFired") increment("domContentEvents");
      if (method === "Page.loadEventFired") increment("loadEvents");
    },
    evaluationFailed: () => increment("evaluationFailures"),
    protocolFailed: () => increment("protocolFailures"),
    snapshot: () => ({
      ...counts,
      scriptFailureReasons: { ...reasons },
      scriptFailuresCanceled: canceled,
    }),
    stop() {
      active = false;
    },
  };
}

// Observation only: native event capture + input-type mutations, never input values.
export const loginReadinessObserver = `(() => {
  if (location.pathname !== "/login") return;
  let active = true;
  const events = [];
  const counts = {showClicks: 0, hideClicks: 0, typeTransitions: 0};
  let previousType = 'NONE';
  const record = category => { if (events.length < 12) events.push(category); };
  const click = event => {
    if (!active) return;
    const label = event.target.closest?.('button')?.getAttribute('aria-label');
    if (label === 'Hiện mật khẩu') { counts.showClicks = Math.min(10000, counts.showClicks + 1); record('SHOW_CLICK'); }
    if (label === 'Ẩn mật khẩu') { counts.hideClicks = Math.min(10000, counts.hideClicks + 1); record('HIDE_CLICK'); }
  };
  const observeType = () => {
    if (!active) return;
    const type = document.querySelector('input[name=password]')?.type;
    const category = type === 'text' ? 'TEXT' : type === 'password' ? 'PASSWORD' : 'NONE';
    if (category !== previousType) {
      previousType = category;
      counts.typeTransitions = Math.min(10000, counts.typeTransitions + 1);
      record(category);
    }
  };
  const observer = new MutationObserver(observeType);
  document.addEventListener('click', click, true);
  observer.observe(document, {subtree: true, childList: true, attributes: true, attributeFilter: ['type']});
  observeType();
  window.__nexoraLoginReadiness = {
    snapshot: () => ({...counts, events: [...events]}),
    stop: () => { active = false; observer.disconnect(); document.removeEventListener('click', click, true); }
  };
})();`;
