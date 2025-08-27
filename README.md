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
