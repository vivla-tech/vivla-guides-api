## Integración Frontend: Homes con Completitud

### Endpoint disponible
- GET `/api/v1/homes/with-completeness`
- Query params: `page`, `pageSize`
- Devuelve lista paginada de casas con `completeness` (0–100), `present`, `missing` y `counts` embebidos.

### Variable de entorno (Next.js)
Define en `.env.local` del frontend:
```
NEXT_PUBLIC_API_BASE_URL=https://vivla-guides-api-production.up.railway.app
```

### Cliente API (ya exportado en este repo)
Métodos añadidos en `clients/js/apiClient.ts`:
- `listHomesWithCompleteness(params?: { page?: number; pageSize?: number })`
- `listHomesCompleteness()` (informe simple por `home_id`)

### Uso típico (Next.js / React)
```ts
import { createApiClient } from "@/clients/js/apiClient";

const api = createApiClient(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`);

// Listado con progreso
const res = await api.listHomesWithCompleteness({ page: 1, pageSize: 20 });
const homes = res.data; // [{ id, name, destination, completeness, counts, ... }]

// Mapear para UI (tabla/badges)
const rows = homes.map(h => ({
  id: h.id,
  name: h.name,
  destination: h.destination,
  progress: h.completeness, // 0-100
}));
```

### Shape de respuesta
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Casa Playa",
      "destination": "Mallorca",
      "completeness": 83,
      "present": ["basic_fields","rooms","inventory","styling_guides","playbooks"],
      "missing": ["technical_plans","appliance_guides"],
      "counts": {
        "rooms": 6,
        "technical_plans": 0,
        "appliance_guides": 1,
        "inventory": 23,
        "styling_guides": 4,
        "playbooks": 2
      }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

### Notas
- Usa una sola llamada (`/homes/with-completeness`) para renderizar el flag/progreso.
- Si solo necesitas el informe global, usa `listHomesCompleteness()`.


