import { api } from "./client";

export const dashboardApi = {
  health: () => api.get("/api/health"),
  seed: () => api.post("/api/seed"),
  stats: () => api.get("/api/stats"),
  summary: () => api.get("/api/dashboard/summary"),

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
  charts: (month) => {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.get(`/api/dashboard/charts${suffix}`);
  },
  
  anomalies: (days = 30, limit = 10) => {
    const qs = new URLSearchParams();
    qs.set("days", String(days));
    qs.set("limit", String(limit));
    return api.get(`/api/dashboard/anomalies?${qs.toString()}`);
  },
  subscriptions: (minOccurrences = 2) => {
    const qs = new URLSearchParams();
    qs.set("min_occurrences", String(minOccurrences));
    return api.get(`/api/subscriptions?${qs.toString()}`);
  },
  copilotInsights: (month) => {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.get(`/api/copilot/insights${suffix}`);
  },

  copilotChat: (message, month, maxRows = 300) => {
    const body = { message, max_rows: maxRows };
    if (month) body.month = month;
    return api.post("/api/copilot/chat", body);
  },

  
};
