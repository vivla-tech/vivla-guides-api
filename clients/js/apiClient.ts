export type ListMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type ListResponse<T> = { success: true; data: T[]; meta: ListMeta };
export type ItemResponse<T> = { success: true; data: T };
export type ErrorResponse = { success: false; error: { message: string; details?: { field?: string; message: string }[] } };

export function createApiClient(baseUrl: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || (body as any)?.success === false) {
      const err = (body as ErrorResponse)?.error || { message: `HTTP ${res.status}` } as any;
      throw new Error(err.message);
    }
    return body as T;
  }

  const q = (params?: Record<string, any>) =>
    params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null) as any).toString() : '';

  return {
    // CRUD genéricos
    list: <T>(resource: string, params?: { page?: number; pageSize?: number }) =>
      request<ListResponse<T>>(`/${resource}${q(params)}`),
    getById: <T>(resource: string, id: string) =>
      request<ItemResponse<T>>(`/${resource}/${id}`),
    create: <T>(resource: string, payload: any) =>
      request<ItemResponse<T>>(`/${resource}`, { method: 'POST', body: JSON.stringify(payload) }),
    update: <T>(resource: string, id: string, payload: any) =>
      request<ItemResponse<T>>(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    remove: (resource: string, id: string) =>
      request<{}>(`/${resource}/${id}`, { method: 'DELETE' }),

    // Helpers específicos
    listStylingGuidesByHome: (homeId: string, params?: { page?: number; pageSize?: number }) =>
      request<ListResponse<any>>(`/styling-guides${q({ home_id: homeId, ...params })}`),
    listPlaybooksByHome: (homeId: string, params?: { page?: number; pageSize?: number }) =>
      request<ListResponse<any>>(`/playbooks${q({ home_id: homeId, ...params })}`),
    listRoomsByHome: (homeId: string, params?: { page?: number; pageSize?: number }) =>
      request<ListResponse<any>>(`/rooms${q({ home_id: homeId, ...params })}`),
    listApplianceGuidesByHome: (homeId: string) =>
      request<{ success: true; data: any[] }>(`/appliance-guides/by-home/${homeId}`),

    linkApplianceGuide: (homeId: string, guideId: string) =>
      request<{ success: true }>(`/appliance-guides/link`, {
        method: 'POST',
        body: JSON.stringify({ home_id: homeId, appliance_guide_id: guideId }),
      }),
    unlinkApplianceGuide: (homeId: string, guideId: string) =>
      request<{ success: true }>(`/appliance-guides/link`, {
        method: 'DELETE',
        body: JSON.stringify({ home_id: homeId, appliance_guide_id: guideId }),
      }),

    // Homes + completeness
    listHomesWithCompleteness: (params?: { page?: number; pageSize?: number }) =>
      request<ListResponse<any>>(`/homes/with-completeness${q(params)}`),
    listHomesCompleteness: () =>
      request<{ success: true; data: any[] }>(`/homes/completeness`),
    listDestinations: () =>
      request<{ success: true; data: string[] }>(`/homes/destinations`),
  };
}
