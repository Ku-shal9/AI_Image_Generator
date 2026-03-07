/**
 * auth-const.js - Constants, seed data, user CRUD (storage)
 */

const EMAILJS_SERVICE_ID = "service_y5y99n8";
const EMAILJS_TEMPLATE_ID = "template_aj0iut3";
const EMAILJS_PUBLIC_KEY = "fBL0yqKEJrRIZNyvL";

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const STORAGE_KEYS = {
  USERS: "pg_users",
  SESSION: "pg_session",
  THEME: "pg_theme",
  GUEST_GENS: "pg_guest_gens",
};

const DEFAULT_RATE_LIMIT = 6;

const GUEST_FREE_LIMIT = 2;

const PLANS = {
  guest: { name: "Guest", limit: 2, price: 0 },
  free: { name: "Free", limit: 6, price: 0 },
  starter: { name: "Starter", limit: 30, price: 4.99 },
  pro: { name: "Pro", limit: 100, price: 9.99 },
  unlimited: { name: "Unlimited", limit: 9999, price: 19.99 },
};

function seedInitialData() {
  const existing = localStorage.getItem(STORAGE_KEYS.USERS);
  if (existing) return;

  const initialUsers = [
    {
      id: "admin-001",
      username: "admin",
      password: "admin123",
      role: "admin",
      createdAt: Date.now(),
      generationsUsed: 0,
      rateLimit: 999,
      promptHistory: [],
      galleryImages: [],
    },
    {
      id: "user-demo",
      username: "demo",
      password: "demo123",
      role: "user",
      createdAt: Date.now(),
      generationsUsed: 0,
      rateLimit: DEFAULT_RATE_LIMIT,
      promptHistory: [],
      galleryImages: [],
    },
  ];

  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
}

function getAllUsers() {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : [];
}

function saveAllUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function findUserByUsername(username) {
  const users = getAllUsers();
  return (
    users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ||
    null
  );
}

function findUserById(id) {
  const users = getAllUsers();
  return users.find((u) => u.id === id) || null;
}

function updateUser(userId, updates) {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  saveAllUsers(users);
}

function createUser(username, password, role = "user") {
  if (!username || !password) {
    return { success: false, message: "Username and password are required." };
  }

  if (findUserByUsername(username)) {
    return { success: false, message: "Username already exists." };
  }

  const newUser = {
    id: "user-" + Date.now(),
    username: username.trim(),
    password: password,
    role: role,
    createdAt: Date.now(),
    generationsUsed: 0,
    rateLimit: role === "admin" ? 999 : DEFAULT_RATE_LIMIT,
    promptHistory: [],
    galleryImages: [],
  };

  const users = getAllUsers();
  users.push(newUser);
  saveAllUsers(users);

  return {
    success: true,
    message: "User created successfully.",
    user: newUser,
  };
}

function deleteUser(userId) {
  const users = getAllUsers();
  const filtered = users.filter((u) => u.id !== userId);

  if (filtered.length === users.length) {
    return { success: false, message: "User not found." };
  }

  saveAllUsers(filtered);
  return { success: true, message: "User deleted." };
}

function setUserRateLimit(userId, newLimit) {
  updateUser(userId, { rateLimit: parseInt(newLimit, 10) });
}
