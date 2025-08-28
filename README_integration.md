## Guía de Integración API (MVP)

- Base URL: `http://<HOST>:<PORT>/api/v1`
- Auth: sin autenticación (MVP). En prod usar Bearer token.
- CORS: abierto por defecto. Variable opcional `CORS_ORIGIN` en backend.
- IDs: UUID v4
- Content-Type: `application/json`

### Paginación y filtros
- Parámetros estándar: `page` (>=1), `pageSize` (1-100)
- Filtro por casa: `?home_id=<UUID>` en `styling-guides` y `playbooks`

### Formato de respuesta
- Listado con meta:
```json
{
  "success": true,
  "data": [ { /* entidad */ } ],
  "meta": { "page": 1, "pageSize": 20, "total": 123, "totalPages": 7 }
}
```
- Detalle / Crear / Actualizar:
```json
{ "success": true, "data": { /* entidad */ } }
```
- Error 422 (validación):
```json
{
  "success": false,
  "error": { "message": "Datos inválidos", "details": [ { "field": "campo", "message": "motivo" } ] }
}
```

### Endpoints de lectura (clave)
- Homes: `GET /homes`, `GET /homes/:id`
- Rooms: `GET /rooms`, `GET /rooms/:id`
- Styling Guides: `GET /styling-guides?home_id=<UUID>`, `GET /styling-guides/:id`
- Playbooks: `GET /playbooks?home_id=<UUID>`, `GET /playbooks/:id`
- Appliance Guides: `GET /appliance-guides/by-home/:homeId`

### Endpoints de vínculo (si aplica)
- Vincular guía a casa:
```bash
POST /appliance-guides/link
{ "home_id": "<UUID>", "appliance_guide_id": "<UUID>" }
```
- Desvincular guía de casa:
```bash
DELETE /appliance-guides/link
{ "home_id": "<UUID>", "appliance_guide_id": "<UUID>" }
```

### Campos por recurso (resumen)
- StylingGuide:
  - `room_id` (UUID), `title` (string)
  - `reference_photo_url` (text), `qr_code_url` (text)
  - `image_urls` (string[])
- Playbook:
  - `room_id` (UUID), `type` (string), `title` (string)
  - `estimated_time` (string), `tasks` (text ~5000), `materials` (string)
- ApplianceGuide:
  - `equipment_name` (string), `brand_id` (UUID|null)
  - `model` (string), `brief_description` (string)
  - `image_urls` (string[]), `pdf_url` (URL), `video_url` (URL)

### Ejemplos rápidos
- Casas (paginación):
```bash
curl -s "http://localhost:3000/api/v1/homes?page=1&pageSize=20"
```
- Styling guides por casa:
```bash
curl -s "http://localhost:3000/api/v1/styling-guides?home_id=<HOME_UUID>&pageSize=10"
```
- Appliance guides por casa:
```bash
curl -s "http://localhost:3000/api/v1/appliance-guides/by-home/<HOME_UUID>"
```

### Notas
- Validaciones: strings máx 255 salvo `tasks` (~5000). URLs con protocolo requerido.
- Relación Home ⇄ ApplianceGuide: única por par; `POST /link` es idempotente.
- Salud: `GET /health` devuelve `{ status: 'ok' }`.
