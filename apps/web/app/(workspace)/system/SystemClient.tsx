"use client";
import { useEffect, useState } from "react";
import { createNexoraClient } from "@nexora/sdk";
import { Panel, StatusBadge } from "@nexora/ui";

type Result = {
  live: boolean;
  ready: boolean;
  database: boolean;
  storage: boolean;
  requestId: string | null;
};

export function SystemClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const client = createNexoraClient();
      const [live, ready] = await Promise.all([
        client.GET("/api/health/live"),
        client.GET("/api/health/ready"),
      ]);
      const body = ready.data ?? ready.error;
      setResult({
        live: live.response.ok,
        ready: ready.response.ok,
        database: body?.checks.database ?? false,
        storage: body?.checks.storage ?? false,
        requestId: ready.response.headers.get("x-request-id"),
      });
    } catch {
      setResult(null);
      setError("Không kết nối được dịch vụ. Kiểm tra Docker rồi thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <p className="eyebrow">VẬN HÀNH</p>
      <h1>Trạng thái hệ thống</h1>
      <p className="intro">
        Trạng thái được kiểm tra trực tiếp khi mở trang hoặc bấm kiểm tra lại.
      </p>
      <button onClick={() => void refresh()} disabled={loading}>
        {loading ? "Đang kiểm tra…" : "Kiểm tra lại"}
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <div className="grid status-grid">
        {[
          ["Tiến trình API", result?.live],
          ["Sẵn sàng sử dụng", result?.ready],
          ["Cơ sở dữ liệu", result?.database],
          ["Lưu trữ file", result?.storage],
        ].map(([label, ok]) => (
          <Panel key={String(label)} title={String(label)}>
            <StatusBadge ok={typeof ok === "boolean" ? ok : null}>
              {ok === undefined
                ? "Chưa kiểm tra"
                : ok
                  ? "Hoạt động"
                  : "Không sẵn sàng"}
            </StatusBadge>
          </Panel>
        ))}
      </div>
      {result?.requestId && (
        <p className="muted">Mã yêu cầu: {result.requestId}</p>
      )}
    </>
  );
}
