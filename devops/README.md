# DevOps

Hạ tầng vận hành cho dự án, tách khỏi `backend/` và `frontend/`.

## ELK stack (`elk/`)

Elasticsearch + Logstash + Kibana + Filebeat, dùng để thu thập log thật của
`backend`. Đây là stack **development/demo** — không bật bảo mật
(`xpack.security.enabled=false`), không TLS, không resource limit cho
traffic thật. Không dùng nguyên trạng cho production.

### Cách log của backend đến được Elasticsearch

Không có thay đổi runtime nào trong backend để "bắn" log qua mạng tới
Logstash — cách đó (pino transport TCP trong-process) sẽ làm request bị
chặn/lỗi nếu Logstash tạm thời không sẵn sàng. Thay vào đó:

1. `backend/src/common/logger/logger.config.ts` đã tắt transport khi
   `NODE_ENV=production`, nên pino ghi **một dòng JSON thuần** ra stdout
   cho mỗi request (đã có test `disables transport in production so logs
   stay single-line JSON` và `produces single-line structured JSON output
   in production mode`). Mỗi dòng còn có field tĩnh `service:
   "ecommerce-backend"` (test `tags every log line with a stable service
   name for ELK/Kibana filtering`) để lọc trong Kibana.
2. Docker daemon tự động ghi stdout của container vào
   `/var/lib/docker/containers/<id>/*.log` (driver `json-file` mặc định).
3. `filebeat` (container trong `docker-compose.elk.yml`) mount
   `/var/run/docker.sock` và `/var/lib/docker/containers` (read-only),
   dùng `autodiscover` để tìm container có tên chứa `ecommerce-backend`
   (tên container mà root `docker-compose.yml` tạo ra cho service
   `backend`) và tail log file của nó.
4. Filebeat forward các dòng log (dạng Beats protocol) tới `logstash:5044`.
5. `logstash` parse lại chuỗi JSON trong `[message]` (filter `json`), rồi
   ghi vào Elasticsearch với index `ecommerce-backend-YYYY.MM.dd`.
6. `kibana` đọc từ Elasticsearch để hiển thị/tìm kiếm.

### Chạy

```bash
# 1. Bật ELK stack
docker compose -f devops/elk/docker-compose.elk.yml up -d

# 2. Bật (hoặc khởi động lại) app stack — Filebeat cần container backend tồn tại
docker compose up -d --build backend

# 3. Kiểm tra Elasticsearch nhận được document
curl -s http://localhost:9200/ecommerce-backend-*/_search?pretty

# 4. Mở Kibana, tạo data view trên index pattern "ecommerce-backend-*"
open http://localhost:5601
```

### Dừng

```bash
docker compose -f devops/elk/docker-compose.elk.yml down -v
```

### Giới hạn đã biết

- Đây là kiến trúc **push qua Docker log file + Filebeat**, không phải
  pino transport trực tiếp — lựa chọn này giữ nguyên hành vi logging đã
  được test của backend và không làm request nghẽn nếu Logstash down.
- Filebeat autodiscover khớp theo **tên container chứa `ecommerce-backend`**
  (tên do root `docker-compose.yml`, project `ecommerce`, service `backend`
  sinh ra). Nếu đổi tên project/service trong root compose, phải cập nhật
  `devops/elk/filebeat/filebeat.yml` tương ứng.
- Chưa cấu hình retention/ILM cho index Elasticsearch — chỉ phù hợp
  development/demo.
