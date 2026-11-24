import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  timeout: 300000, // 5 phút để không bị ngắt kết nối khi AI tách vocal
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const expiresAt = Number(localStorage.getItem("tokenExpiresAt"));
    if (token && expiresAt && expiresAt <= Date.now()) {
      localStorage.removeItem("token");
      localStorage.removeItem("tokenExpiresAt");
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export default API;