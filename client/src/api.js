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

const api = {
  auth: {
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
  },
  memos: {
    list: (category = "") => instance.get(`/api/memos/${category ? `?category=${category}` : ''}`),
    get: (id, password = "") => instance.get(`/api/memos/${id}/?password=${encodeURIComponent(password)}`),
    create: (data) => instance.post("/api/memos/", data),
    patch: (id, data) => instance.patch(`/api/memos/${id}/`, data),
    delete: (id) => instance.delete(`/api/memos/${id}/`),
    search: (q) => instance.get(`/api/memos/search/?q=${encodeURIComponent(q)}`),
    togglePublic: (id) => instance.post(`/api/memos/${id}/toggle_public/`),
    toggleLock: (id, password) => instance.post(`/api/memos/${id}/toggle_lock/`, { password }),
    addComment: (id, data) => instance.post(`/api/memos/${id}/add_comment/`, data),
    addCollaborator: (id, email) => instance.post(`/api/memos/${id}/add_collaborator/`, { email }),
    getShared: (slug, password = "") => instance.get(`/api/memos/shared/${slug}/?password=${encodeURIComponent(password)}`),
    postSharedComment: (slug, data) => instance.post(`/api/memos/shared/${slug}/`, data),
    importShared: (slug) => instance.post(`/api/memos/import/${slug}/`),
  },
  briefing: {
    today: () => instance.get("/api/briefing/today/"),
    check: (id) => instance.post(`/api/briefing/check/${id}/`),
  },
  lifecards: {
    list: () => instance.get("/api/lifecards/"),
  },
  contacts: {
    list: (search = "") => instance.get(`/api/contacts/?search=${encodeURIComponent(search)}`),
    create: (data) => instance.post("/api/contacts/", data),
    update: (id, data) => instance.put(`/api/contacts/${id}/`, data),
    delete: (id) => instance.delete(`/api/contacts/${id}/`),
  }
};

export default api;
