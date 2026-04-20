import axios from "axios";

const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000"
  : "https://worked-note.onrender.com";

const instance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// 요청 인터셉터: 헤더에 JWT 토큰 자동 추가
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("wn-access");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터: 토큰 만료 처리 (예: 401 에러 시 로그아웃)
instance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // 토큰 갱신 로직 (선택사항) 또는 로그아웃 처리
      localStorage.removeItem("wn-access");
      localStorage.removeItem("wn-refresh");
      localStorage.removeItem("wn-user");
      // window.location.href = "/";
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
      try {
        if (refresh) await instance.post("/api/auth/logout/", { refresh });
      } finally {
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
    changePassword: (data) => instance.put("/api/auth/change_password/", data),
    requestPasswordReset: (email) => instance.post("/api/auth/password_reset/", { email }),
    confirmPasswordReset: (data) => instance.post("/api/auth/password_reset_confirm/", data),
  },
  memos: {
    list: () => instance.get("/api/memos/"),
    create: (data) => instance.post("/api/memos/", data),
    patch: (id, data) => instance.patch(`/api/memos/${id}/`, data),
    delete: (id) => instance.delete(`/api/memos/${id}/`),
    search: (q) => instance.get(`/api/memos/search/?q=${encodeURIComponent(q)}`),
    stats: () => instance.get("/api/memos/stats/"),
    toggleShare: (id) => instance.post(`/api/memos/${id}/toggle_share/`),
    getShare: (token) => instance.get(`/api/memos/share/${token}/`),
  },
  contacts: {
    list: (search = "") => instance.get(`/api/contacts/?search=${encodeURIComponent(search)}`),
    create: (data) => instance.post("/api/contacts/", data),
    update: (id, data) => instance.put(`/api/contacts/${id}/`, data),
    delete: (id) => instance.delete(`/api/contacts/${id}/`),
    byGroup: () => instance.get("/api/contacts/by_group/"),
  },
  messaging: {
    send: (data) => instance.post("/api/messaging/send/", data),
    history: () => instance.get("/api/messaging/history/"),
  },
};

export default api;
