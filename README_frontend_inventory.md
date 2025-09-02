## Integración Frontend: Inventario por Casa

### Endpoint disponible
- GET `/api/v1/home-inventory`
- Query params:
  - `home_id` (requerido): UUID de la casa
  - `page`, `pageSize` (opcionales): paginación

### Qué devuelve
- Lista paginada de ítems de inventario de esa casa, con relaciones pobladas:
  - `home`
  - `amenity` (incluye `category` y `brand`)
  - `room`
  - `supplier`

### Variable de entorno (Next.js)
Define en `.env.local` del frontend:
```
NEXT_PUBLIC_API_BASE_URL=https://vivla-guides-api-production.up.railway.app
```

### Uso con el cliente API existente
```ts
import { createApiClient } from "@/clients/js/apiClient";

const api = createApiClient(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1`);

// Inventario de una casa (con paginación)
const res = await api.list<any>("home-inventory", {
  home_id: homeId,   // UUID de la casa
  page: 1,
  pageSize: 50,
});

const items = res.data; // Array de ítems con amenity+brand+category, room, supplier, home
```

### Ejemplo curl
```bash
curl "${NEXT_PUBLIC_API_BASE_URL}/api/v1/home-inventory?home_id=UUID&page=1&pageSize=50"
```

### Shape de respuesta (resumen)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "home_id": "uuid",
      "amenity_id": "uuid",
      "room_id": "uuid",
      "quantity": 2,
      "location_details": "Cocina",
      "purchase_price": 150.0,
      "notes": null,
      "home": { "id": "uuid", "name": "Casa Playa", "destination": "Mallorca", "address": "...", "main_image": "..." },
      "amenity": {
        "id": "uuid",
        "name": "Cafetera",
        "reference": "REF-001",
        "model": "Essenza Mini",
        "base_price": 120.0,
        "images": ["url1", "url2"],
        "category": { "id": "uuid", "name": "Electrodomésticos" },
        "brand": { "id": "uuid", "name": "Nespresso" }
      },
      "room": { "id": "uuid", "name": "Cocina" },
      "supplier": { "id": "uuid", "name": "Amazon" }
    }
  ],
  "meta": { "page": 1, "pageSize": 50, "total": 23, "totalPages": 1 }
}
```

### Notas
- Usa `home_id` para filtrar por casa. Si no lo pasas, obtendrás todo el inventario.
- Las relaciones ya vienen incluidas para renderizar nombres de amenity, marcas, modelos, habitación y proveedor sin llamadas extra.


