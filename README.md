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

### Endpoints
- Salud: `GET /health`
- API base: `/api/v1`

CRUDs para: `homes`, `brands`, `categories`, `suppliers`, `amenities`, `home-inventory`, `technical-plans`, `appliance-guides`, `rooms`, `rooms-type`, `styling-guides`, `playbooks`, `media-files`.

### Estructura
Ver `src/` para configuración, modelos, rutas, middlewares, servicios y utilidades.

### Scripts
- `npm run migrate` / `npm run seed` / `npm run reset:db`
- `npm run dev` para desarrollo
- `npm start` para producción
