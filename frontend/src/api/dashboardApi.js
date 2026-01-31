import { api } from "./client";

export const dashboardApi = {
  health: () => api.get("/api/health"),
  seed: () => api.post("/api/seed"),
  stats: () => api.get("/api/stats"),
  summary: () => api.get("/api/dashboard/summary"),
  charts: () => api.get("/api/dashboard/charts"),

  categoryBreakdown: (month, category, merchantLimit = 10, txLimit = 10) => {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (category) qs.set("category", category);
    qs.set("merchantLimit", String(merchantLimit));
    qs.set("txLimit", String(txLimit));
    return api.get(`/api/dashboard/category-breakdown?${qs.toString()}`);
  },

  monthlyDeltas: (month, topK = 3, merchantsPerCategory = 5) => {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    qs.set("topK", String(topK));
    qs.set("merchantsPerCategory", String(merchantsPerCategory));
    return api.get(`/api/dashboard/insights/monthly-deltas?${qs.toString()}`);
  },
};
