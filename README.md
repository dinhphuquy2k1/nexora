# Nexora · Quản lý vận đơn độc lập

Foundation v0.1.0: NestJS API, Next.js shell tiếng Việt, health endpoints, PostgreSQL catalog, local file storage và OpenAPI SDK. Nghiệp vụ vận đơn, quản lý khách hàng, theo dõi mã vận đơn, import XLSX, tích hợp nhà cung cấp vận chuyển và identity **chưa triển khai**. Không có login/RBAC; chỉ chạy cục bộ. Đây là nền tảng kỹ thuật hạ tầng (infrastructure only), không phải bản MVP hay public production deployment.

## Khởi động từ checkout

Cài Docker Desktop (Windows/macOS, bật Linux containers) hoặc Docker Engine + Compose v2 trên Linux, rồi mở Docker. Lần đầu cần Internet để tải image/dependencies.

```sh
docker compose up --build -d
# Hoặc ./start.sh; Windows: Start.cmd
# Start scripts chờ health với timeout 180 giây sau build.
docker compose ps
docker compose down
# Hoặc ./stop.sh; Windows: Stop.cmd — KHÔNG xóa volumes
```

Web dùng cổng `http://localhost:3001` (có thể cấu hình qua biến `WEB_PORT`, mặc định 127.0.0.1:3001). PostgreSQL và API không publish cổng ra ngoài host. Không cần Node/pnpm/PostgreSQL trên host hoặc sửa `.env`. Credentials local được tạo ngẫu nhiên một lần trong named volume, không in ra logs. Dữ liệu DB và file nguồn nằm trong named volumes độc lập.

`compose.release.yml` và `--prebuilt` là **template phân phối chưa khả dụng**: các image `ghcr.io/dinhphuquy2k1/nexora-*:0.1.0` chưa publish. Lệnh mặc định luôn build từ source; task này không push image hoặc deploy.

## Phát triển và kiểm chứng

```sh
docker compose -f compose.yml -f compose.dev.yml up --build
docker compose -f compose.yml -f compose.dev.yml down
sh scripts/quality-docker.sh
sh scripts/runtime-smoke.sh
sh scripts/data-smoke.sh
sh scripts/dev-smoke.sh
```

Smoke scripts dùng project/volumes riêng biệt; dừng stack đang chiếm cổng 3001 trước khi chạy. Quality script dùng stack hiện tại và không reset DB. Xem [testing](docs/operations/testing.md), [task evidence](docs/tasks/completed/NEXORA-001-foundation.md) và [setup/platform matrix](docs/operations/setup.md).

```sh
sh scripts/backup.sh backups/2026-10-09
sh scripts/restore.sh backups/2026-10-09 --to-new-project nexora-restored
```

Backup/restore POSIX cần Docker, shell và công cụ POSIX cơ bản; Windows dùng WSL/Git Bash. Restore chỉ tạo project mới, không ghi đè dữ liệu. Xem [backup/restore](docs/operations/backup-restore.md).

## Tài liệu

[Mục lục tài liệu](docs/README.md) · [Architecture](docs/architecture/overview.md) · [Configuration](docs/operations/configuration.md) · [Deployment limits](docs/operations/deployment.md) · [Domain notes](docs/domains/shipments.md) · [ADR-001 Baseline](docs/decisions/technology-baseline.md) · [ADR-002 Product Scope](docs/decisions/product-scope.md) · [ADR-003 Reference Policy](docs/decisions/reference-architecture-policy.md).

Milestone tiếp theo: Nghiên cứu khả thi API nhà cung cấp / mô hình thực thể Vận đơn & Khách hàng, import Excel danh sách kiện hàng.
