# Nexora · Quản lý vận đơn độc lập

Foundation v0.1.0: NestJS API, Next.js Web shell tiếng Việt, PostgreSQL catalog, local file storage, Prisma migrations, OpenAPI SDK, xác thực ADMIN nội bộ (Argon2id, session cookie), unified identity storage, nền tảng xác thực OPERATOR liên kết nhà cung cấp (Uniship mock), quản lý phiên và đăng xuất. Các nghiệp vụ Vận đơn đầy đủ (tạo đơn, điều phối, theo dõi kiện hàng), phân tích dữ liệu, giao diện quản trị nhân viên hoàn chỉnh và tích hợp API Uniship trực tiếp đang trong lộ trình phát triển. Hệ thống hiện chỉ chạy cục bộ, không phải bản public production deployment.

## Khởi động từ checkout

Cài Docker Desktop (Windows/macOS, bật Linux containers) hoặc Docker Engine + Compose v2 trên Linux, rồi mở Docker. Lần đầu cần Internet để tải image/dependencies.

### Chế độ chuẩn (Standard mode)

Khởi động các dịch vụ và đợi hoàn tất kiểm tra healthcheck:

```sh
docker compose up --build -d --wait
```

Kiểm tra trạng thái dịch vụ:

```sh
docker compose ps
```

Xem logs thời gian thực:

```sh
docker compose logs -f
```

Dừng ứng dụng:

```sh
docker compose down
```

Ứng dụng khả dụng tại: `http://localhost:3001` (có thể cấu hình qua biến `WEB_PORT`, mặc định `127.0.0.1:3001`).

Lệnh `docker compose down` (không dùng cờ `-v`) giữ nguyên toàn bộ dữ liệu trong các Docker named volumes (PostgreSQL, uploads, credentials). Không bao giờ sử dụng `docker compose down -v` trừ khi bạn chủ động muốn xóa sạch toàn bộ dữ liệu.

Trong chế độ chuẩn, PostgreSQL và API không publish cổng ra ngoài host để đảm bảo an toàn mạng. Credentials local được tạo ngẫu nhiên một lần trong named volume, không in ra logs. Hạ tầng backup/restore tùy biến trước đây đã được tinh giản (xem ADR-006); dữ liệu được duy trì tự nhiên qua PostgreSQL named volumes.

`compose.release.yml` là **template phân phối chưa khả dụng**: các container image `ghcr.io/dinhphuquy2k1/nexora-*:0.1.0` chưa được publish. Lệnh mặc định luôn build từ source qua `compose.yml`; không sử dụng `compose.release.yml` khi các image chưa được phát hành.

### Chế độ phát triển (Development mode)

Khởi động với file override phát triển:

```sh
docker compose -f compose.yml -f compose.dev.yml up --build
```

Dừng chế độ phát triển:

```sh
docker compose -f compose.yml -f compose.dev.yml down
```

Lưu ý: Cả hai lệnh khởi động và dừng phát triển bắt buộc phải sử dụng cùng tổ hợp file Compose (`-f compose.yml -f compose.dev.yml`).

Trong chế độ phát triển, PostgreSQL tự động mở cổng loopback `127.0.0.1:5432` lên host (có thể cấu hình số cổng qua biến `POSTGRES_PORT` trong `.env`, luôn luôn gắn chặt vào địa chỉ loopback `127.0.0.1`), cho phép các công cụ quản lý cơ sở dữ liệu như DBeaver hoặc pgAdmin kết nối trực tiếp. Chế độ chuẩn không publish cổng PostgreSQL ra host.

## Phát triển và kiểm chứng

```sh
sh scripts/quality-docker.sh
sh scripts/runtime-smoke.sh
sh scripts/data-smoke.sh
sh scripts/dev-smoke.sh
```

Smoke scripts dùng project/volumes riêng biệt; dừng stack đang chiếm cổng 3001 trước khi chạy. Quality script dùng stack hiện tại và không reset DB. Xem [testing](docs/operations/testing.md), [task evidence](docs/tasks/completed/NEXORA-001-foundation.md) và [setup/platform matrix](docs/operations/setup.md).

## Tài liệu

[Mục lục tài liệu](docs/README.md) · [Architecture](docs/architecture/overview.md) · [Configuration](docs/operations/configuration.md) · [Deployment limits](docs/operations/deployment.md) · [Domain notes](docs/domains/shipments.md) · [ADR-001 Baseline](docs/decisions/technology-baseline.md) · [ADR-002 Product Scope](docs/decisions/product-scope.md) · [ADR-003 Reference Policy](docs/decisions/reference-architecture-policy.md).

Milestone tiếp theo: Nghiên cứu khả thi API nhà cung cấp / mô hình thực thể Vận đơn & Khách hàng, import Excel danh sách kiện hàng.
