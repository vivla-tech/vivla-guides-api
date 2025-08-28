## VIVLA Guides - Backend

### Requisitos
- Node.js >= 18
- PostgreSQL >= 13

### Instalación
1. Copia el archivo `.env.example` a `.env` y ajusta valores.
2. Instala dependencias:
```bash
npm install
```
3. Ejecuta migraciones y seeders:
```bash
npx sequelize db:migrate
npx sequelize db:seed:all
```
4. Levanta el servidor en desarrollo:
```bash
npm run dev
```

### Migraciones desde Airtable (CLI)

Variables .env relevantes:
- AIRTABLE_TOKEN
- AT_BASIC_BASE (p. ej. `appGt0lNhV0cRxYB1`)
- AT_HOMES_BASE/AT_HOMES_TABLE/AT_HOMES_VIEW
- AT_AMENITIES_TABLE/AT_AMENITIES_VIEW
- AT_CATEGORIES_TABLE (view vacía para recorrer todo)
- AT_INVENTORY_TABLE/AT_INVENTORY_VIEW
- AT_GUIDES_TABLE/AT_GUIDES_VIEW
- AT_STYLING_TABLE/AT_STYLING_VIEW
- Firebase: FIREBASE_CREDENTIALS_FILE, FIREBASE_STORAGE_BUCKET (p. ej. `community-guides.appspot.com`)

Orden recomendado:
1) Homes
```bash
npm run migrate:homes -- --dry-run
npm run migrate:homes -- --update
```
2) Categories (desde amenities/items)
```bash
npm run migrate:categories -- --dry-run
npm run migrate:categories
```
3) Amenities
```bash
npm run migrate:amenities -- --dry-run
npm run migrate:amenities -- --update
```
4) Inventory
```bash
npm run migrate:inventory -- --dry-run --report
npm run migrate:inventory -- --update
```
5) Appliance guides
```bash
npm run migrate:guides -- --dry-run
npm run migrate:guides -- --update
```
6) Room types (derivados de estilismo)
```bash
npm run report:room-types
npm run migrate:room-types
```
7) Styling guides + Playbooks
```bash
npm run migrate:styling -- --dry-run
npm run migrate:styling -- --update
# Para forzar re-subida de media a Firebase
npm run migrate:styling -- --reupload-media
```

Reportes y mantenimiento (opcionales):
- `npm run report:amenities`
- `npm run report:inventory`
- `npm run consolidate:amenities`

Notas:
- Todos los scripts aceptan flags `--base/--table/--view` para override puntuales.
- Idempotencia: los scripts usan findOrCreate y `--update` para actualizar existentes.
- Media: se sube a Firebase; si usas `--reupload-media`, se fuerza la actualización de imágenes.

### API - Nuevos campos y filtros

Endpoints relevantes:

- Styling Guides
  - GET `/api/v1/styling-guides?home_id=<uuid>` — lista filtrada por casa (usa `Room.home_id`)
  - Campos: `reference_photo_url` (TEXT), `qr_code_url` (TEXT), `image_urls` (JSON array de URLs)

- Playbooks
  - GET `/api/v1/playbooks?home_id=<uuid>` — lista filtrada por casa (usa `Room.home_id`)

- Appliance Guides
  - GET `/api/v1/appliance-guides/by-home/:homeId` — guías vinculadas a una casa
  - POST `/api/v1/appliance-guides/link` — vincula guía a casa (idempotente)
  - DELETE `/api/v1/appliance-guides/link` — desvincula guía de casa
  - Campos: `image_urls` (JSON array de URLs), `pdf_url` (URL), `video_url` (URL)

Ejemplos:

```bash
# Filtrar styling_guides por home
curl -s "http://localhost:3000/api/v1/styling-guides?home_id=<HOME_UUID>&pageSize=10"

# Filtrar playbooks por home
curl -s "http://localhost:3000/api/v1/playbooks?home_id=<HOME_UUID>&pageSize=10"

# Listar guías de electrodomésticos por home
curl -s "http://localhost:3000/api/v1/appliance-guides/by-home/<HOME_UUID>"

# Vincular guía a home
curl -s -X POST "http://localhost:3000/api/v1/appliance-guides/link" \
  -H 'Content-Type: application/json' \
  --data '{"home_id":"<HOME_UUID>","appliance_guide_id":"<GUIDE_UUID>"}'

# Desvincular guía de home
curl -s -X DELETE "http://localhost:3000/api/v1/appliance-guides/link" \
  -H 'Content-Type: application/json' \
  --data '{"home_id":"<HOME_UUID>","appliance_guide_id":"<GUIDE_UUID>"}'
```

Notas técnicas:
- Validación: URLs con protocolo obligatorio; arrays de URLs aceptados.
- Constraint: `home_appliance_guides(home_id, appliance_guide_id)` es UNIQUE (evita duplicados).

### API - Endpoints CRUD por recurso

Formato general:
- Listado: `GET /api/v1/<recurso>` (pag: `page`, `pageSize`)
- Detalle: `GET /api/v1/<recurso>/:id`
- Crear: `POST /api/v1/<recurso>`
- Actualizar: `PUT /api/v1/<recurso>/:id`
- Borrar: `DELETE /api/v1/<recurso>/:id`
 - Filtros: para recursos basados en `Room` (p. ej., `styling-guides`, `playbooks`) se admite `?home_id=<uuid>` que filtra por `Room.home_id`.

Recursos y rutas base:
- Homes: `/api/v1/homes`
- Rooms: `/api/v1/rooms`
- Rooms Type: `/api/v1/rooms-type`
- Brands: `/api/v1/brands`
- Categories: `/api/v1/categories`
- Suppliers: `/api/v1/suppliers`
- Amenities: `/api/v1/amenities`
- Home Inventory: `/api/v1/home-inventory`
- Technical Plans: `/api/v1/technical-plans`
- Appliance Guides: `/api/v1/appliance-guides`
- Styling Guides: `/api/v1/styling-guides`
- Playbooks: `/api/v1/playbooks`

Paginación:
```bash
curl -s "http://localhost:3000/api/v1/amenities?page=1&pageSize=20"
```

Filtro por home_id (recursos basados en Room):
```bash
curl -s "http://localhost:3000/api/v1/styling-guides?home_id=<HOME_UUID>&pageSize=10"
curl -s "http://localhost:3000/api/v1/playbooks?home_id=<HOME_UUID>&pageSize=10"
```

Detalle:
```bash
curl -s "http://localhost:3000/api/v1/homes/<UUID>"
```

Crear ejemplo (amenity mínimo):
```bash
curl -s -X POST "http://localhost:3000/api/v1/amenities" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Ejemplo","brand_id":null,"category_id":null}'
```

Actualizar:
```bash
curl -s -X PUT "http://localhost:3000/api/v1/rooms/<UUID>" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Dormitorio principal"}'
```

Eliminar:
```bash
curl -s -X DELETE "http://localhost:3000/api/v1/brands/<UUID>"
```

### Formato de respuesta

- Listado (con paginación):

```json
{
  "success": true,
  "data": [ { /* entidad */ }, { /* ... */ } ],
  "meta": { "page": 1, "pageSize": 20, "total": 123, "totalPages": 7 }
}
```

- Detalle / Creación / Actualización:

```json
{
  "success": true,
  "data": { /* entidad */ }
}
```

- Error de validación (422):

```json
{
  "success": false,
  "error": {
    "message": "Datos inválidos",
    "details": [
      { "field": "campo", "message": "motivo" }
    ]
  }
}
```
