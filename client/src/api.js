import axios from "axios";

const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000"
  : "https://worked-note.onrender.com";

const instance = axios.create({
  baseURL: API_URL,
  timeout: 40000,
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("wn-access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("wn-access");
      localStorage.removeItem("wn-refresh");
      localStorage.removeItem("wn-user");
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: async (email, password) => {
    const data = await instance.post("/api/auth/login/", { username: email, password });
    localStorage.setItem("wn-access", data.access);
    localStorage.setItem("wn-refresh", data.refresh);
    localStorage.setItem("wn-user", JSON.stringify(data.user));
    return data;
  },
  signup: (userData) => instance.post("/api/auth/signup/", userData),
  logout: async () => {
    const refresh = localStorage.getItem("wn-refresh");
    try { if (refresh) await instance.post("/api/auth/logout/", { refresh }); }
    finally {
      localStorage.removeItem("wn-access");
      localStorage.removeItem("wn-refresh");
      localStorage.removeItem("wn-user");
    }
  },
  me: () => {
    const user = localStorage.getItem("wn-user");
    if (user) return Promise.resolve(JSON.parse(user));
    return instance.get("/api/auth/me/");
  },
  requestPasswordReset: (email) => instance.post("/api/auth/password_reset/", { email }),
  confirmPasswordReset: (data) => instance.post("/api/auth/password_reset_confirm/", data),
  changePassword: (data) => instance.post("/api/auth/password_change/", data),
};

export const memos = {
  list: () => instance.get("/api/memos/"),
  get: (id) => instance.get(`/api/memos/${id}/`),
  create: (data) => instance.post("/api/memos/", data),
  patch: (id, data) => instance.patch(`/api/memos/${id}/`, data),
  delete: (id) => instance.delete(`/api/memos/${id}/`),
  toggleShare: (id) => instance.post(`/api/memos/${id}/toggle_public/`),
  getShare: (slug) => instance.get(`/api/memos/shared/${slug}/`),
};

export const contacts = {
  list: () => instance.get("/api/contacts/"),
  create: (data) => instance.post("/api/contacts/", data),
  patch: (id, data) => instance.patch(`/api/contacts/${id}/`, data),
  delete: (id) => instance.delete(`/api/contacts/${id}/`),
};

export const messaging = {
  send: (data) => instance.post("/api/messaging/send/", data),
  history: () => instance.get("/api/messaging/history/"),
};
