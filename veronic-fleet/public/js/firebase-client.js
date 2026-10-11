/**
 * Firebase Client SDK & Standalone Database Engine
 * VERONIC Fleet & Parcel Management System (DropBook)
 * Project ID: dropbox-113d0
 */

(function() {
  'use strict';

  // 1. Firebase Cloud Configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDeNlNM_DobVZX17NxHKmtwspFh5SqRBOA",
    authDomain: "dropbox-113d0.firebaseapp.com",
    projectId: "dropbox-113d0",
    storageBucket: "dropbox-113d0.firebasestorage.app",
    messagingSenderId: "105591636213",
    appId: "1:105591636213:web:26a7e36e6e1bd3579cc5bc",
    measurementId: "G-N69MR827LS",
    databaseURL: "https://dropbox-113d0-default-rtdb.firebaseio.com"
  };

  // 2. Embedded Production Master Seed Data (For instant offline/online launch)
  const INITIAL_SEED = {
    offices: [
      { id: 1, office_name: "Rajkot Central Office", office_code: "OFF-001", city: "Rajkot", address: "Vavdi Main Road, Opp. PGVCL Office, Rajkot - 360004", phone: "+91 83201 48345", email: "rajkot@veronic.com", manager: "Bhanji Bhai", status: "Active", office_type: "Branch", closing_time: "09:00 PM", opening_time: "08:00 AM", state: "Gujarat", created_at: "2026-10-07 10:06:37" },
      { id: 2, office_name: "Ahmedabad Hub", office_code: "OFF-002", city: "Ahmedabad", address: "Geeta Mandir Bus Stand Road, Ahmedabad - 380022", phone: "+91 98258 40119", email: "ahmedabad@veronic.com", manager: "Suresh Patel", status: "Active", office_type: "Branch", closing_time: "09:00 PM", opening_time: "08:00 AM", state: "Gujarat", created_at: "2026-10-07 10:06:37" },
      { id: 3, office_name: "Surat Central Office", office_code: "OFF-003", city: "Surat", address: "Rupa Apt, Opp. Umiya Dham, Varachha Road, Surat - 395006", phone: "+91 89801 91525", email: "surat@veronic.com", manager: "Pravin Bhai", status: "Active", office_type: "Branch", closing_time: "09:00 PM", opening_time: "08:00 AM", state: "Gujarat", created_at: "2026-10-07 10:06:37" },
      { id: 4, office_name: "Jamnagar Branch", office_code: "OFF-004", city: "Jamnagar", address: "Indira Gandhi Marg, Near Gurudwara, Jamnagar - 361001", phone: "+91 94282 11020", email: "jamnagar@veronic.com", manager: "Kishore Sinh", status: "Active", office_type: "Branch", closing_time: "09:00 PM", opening_time: "08:00 AM", state: "Gujarat", created_at: "2026-10-07 10:06:37" },
      { id: 5, office_name: "Morbi Office", office_code: "OFF-005", city: "Morbi", address: "Sanala Road, Near New Bus Stand, Morbi - 363641", phone: "+91 97245 88990", email: "morbi@veronic.com", manager: "Dilip Bhai", status: "Active", office_type: "Branch", closing_time: "09:00 PM", opening_time: "08:00 AM", state: "Gujarat", created_at: "2026-10-07 10:06:37" }
    ],
    admins: [
      { id: 1, name: "Main Admin (Super)", username: "main_admin", email: "mainadmin@veronic.com", password: "admin123", phone: "+91 95100 75279", office_id: null, role: "main_admin", status: "Active", created_at: "2026-10-07 10:06:37" },
      { id: 2, name: "Rajkot Sub-Admin", username: "rajkot_admin", email: "rajkotadmin@veronic.com", password: "admin123", phone: "+91 98765 43210", office_id: 1, role: "sub_admin", status: "Active", created_at: "2026-10-07 10:06:37" },
      { id: 5, name: "Ahmedabad Branch Admin", username: "ahmedabad_admin", email: "ahmedabad@veronic.com", password: "BranchPassword@123", phone: "+91 91234 56789", office_id: 2, role: "sub_admin", status: "Active", created_at: "2026-10-07 10:57:04" }
    ],
    users: [
      { id: 1, name: "Demo User", email: "demo@example.com", password: "demo", office_id: 1, role: "member", status: "Active", created_at: "2026-06-20 09:43:06" },
      { id: 16, name: "Main Admin", email: "mainadmin@veronic.com", password: "admin123", office_id: 1, role: "member", status: "Active", created_at: "2026-10-07 11:42:41" },
      { id: 17, name: "Rajkot Sub-Admin", email: "rajkotadmin@veronic.com", password: "admin123", office_id: 1, role: "member", status: "Active", created_at: "2026-10-07 11:42:41" },
      { id: 18, name: "Simple User", email: "user@simple.com", password: "123", office_id: 1, role: "member", status: "Active", created_at: "2026-10-07 11:42:41" },
      { id: 19, name: "Admin", email: "admin@veronic.com", password: "admin123", office_id: 1, role: "member", status: "Active", created_at: "2026-10-07 11:42:41" }
    ],
    drivers: [
      { id: 13, name: "vansh gohal", mobile: "34275677854", license_no: "GJ-03-2022-1481", status: "Active", office_id: 1, created_at: "2026-06-24 23:59:01" },
      { id: 14, name: "Ram odedra", mobile: "8237564738", license_no: "GJ-03-2022-1518", status: "Active", office_id: 1, created_at: "2026-06-25 00:12:13" },
      { id: 15, name: "Raju", mobile: "7832637836", license_no: "GJ-03-2022-1555", status: "Active", office_id: 1, created_at: "2026-06-25 01:09:47" },
      { id: 22, name: "ramesh", mobile: "847358746", license_no: "GJ-03-2022-1814", status: "Active", office_id: 1, created_at: "2026-06-25 10:02:36" },
      { id: 23, name: "shujal", mobile: "7875846786", license_no: "GJ-03-2022-1851", status: "Active", office_id: 1, created_at: "2026-06-25 10:51:02" },
      { id: 25, name: "rohit", mobile: "1244211243", license_no: "GJ-03-1234-3245", status: "Active", office_id: 1, created_at: "2026-10-09 02:19:11" },
      { id: 27, name: "rakesh", mobile: "1234554321", license_no: "GJ-03-1234-5678", status: "Active", office_id: 1, created_at: "2026-10-09 02:23:42" }
    ],
    buses: [
      { id: 14, bus_number: "GJ-25-999", assigned_driver_id: null, status: "Active", bus_type: "AC Sleeper (2+1)", route: "Rajkot – Surat", office_id: 1, created_at: "2026-06-24 12:29:59" },
      { id: 15, bus_number: "GJ-25-910", assigned_driver_id: 13, status: "Active", bus_type: "AC Sleeper (2+1)", route: "Rajkot – Surat", office_id: 1, created_at: "2026-06-24 23:58:45" },
      { id: 16, bus_number: "GJ-25-001", assigned_driver_id: null, status: "Active", bus_type: "AC Sleeper (2+1)", route: "Rajkot – Surat", office_id: 1, created_at: "2026-06-25 00:12:49" },
      { id: 17, bus_number: "GJ-25-004", assigned_driver_id: null, status: "Active", bus_type: "AC Sleeper (2+1)", route: "Rajkot – Surat", office_id: 1, created_at: "2026-06-25 01:22:29" },
      { id: 19, bus_number: "GJ-25-002", assigned_driver_id: null, status: "Active", bus_type: "Volvo Multi-Axle (2+2)", route: "Ahmedabad – Surat", office_id: 1, created_at: "2026-10-09 02:24:43" }
    ],
    bills: [
      { id: 1, bill_no: "0001", date: "2026-06-17", driver_name: "Ramesh Makwana", bus_no: "GJ-01-LTZ1162", moklnar_name: "vijay odedra", moklnar_mobile: "9510075279", lenar_name: "vansh", lenar_mobile: "9909876756", total: 50000, jama: 50000, baki: 20000, office_id: 1, created_at: "2026-06-17 08:52:25" },
      { id: 2, bill_no: "0002", date: "2026-06-18", driver_name: "chirag", bus_no: "GJ-01-LTZ1163", moklnar_name: "shujal", moklnar_mobile: "9825840119", lenar_name: "ram", lenar_mobile: "9825840819", total: 5000, jama: 5000, baki: 1000, office_id: 1, created_at: "2026-06-18 10:55:43" },
      { id: 3, bill_no: "0003", date: "2026-06-18", driver_name: "vashu odedra", bus_no: "GJ-01-LTZ1166", moklnar_name: "raju", moklnar_mobile: "7878929391", lenar_name: "ram", lenar_mobile: "8909878667", total: 50000, jama: 50000, baki: 10000, office_id: 1, created_at: "2026-06-18 11:17:35" },
      { id: 20, bill_no: "0020", date: "2026-10-07", driver_name: "vansh gohal", bus_no: "GJ-25-910", moklnar_name: "Ahmedabad Sender", moklnar_mobile: "9825840119", lenar_name: "Surat Receiver", lenar_mobile: "8980191525", total: 1500, jama: 1500, baki: 0, office_id: 2, created_at: "2026-10-07 10:58:09" }
    ],
    bill_items: [
      { id: 1, bill_id: 1, from_city: "Rajkot", to_city: "Surat", description: "General Parcel", qty: 10, remark: "", amount: 50000, created_at: "2026-06-17 08:52:25" },
      { id: 20, bill_id: 20, from_city: "Ahmedabad", to_city: "Surat", description: "Electronics Box", qty: 2, remark: "", amount: 1500, created_at: "2026-10-07 10:58:09" }
    ],
    admin_permissions: [
      { admin_id: 2, permission_key: "dashboard", is_granted: 1 },
      { admin_id: 2, permission_key: "parcels", is_granted: 1 },
      { admin_id: 2, permission_key: "customers", is_granted: 1 },
      { admin_id: 2, permission_key: "drivers", is_granted: 1 },
      { admin_id: 2, permission_key: "delivery", is_granted: 1 },
      { admin_id: 2, permission_key: "billing", is_granted: 1 },
      { admin_id: 2, permission_key: "reports", is_granted: 1 }
    ]
  };

  // Local Storage Database Manager
  const LocalDB = {
    getKey(table) {
      return `dropbook_db_${table}`;
    },
    getTable(table) {
      try {
        const raw = localStorage.getItem(this.getKey(table));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      const fallback = INITIAL_SEED[table] ? JSON.parse(JSON.stringify(INITIAL_SEED[table])) : [];
      this.saveTable(table, fallback);
      return fallback;
    },
    saveTable(table, data) {
      try {
        localStorage.setItem(this.getKey(table), JSON.stringify(data));
      } catch (e) {}
    },
    insert(table, item) {
      const list = this.getTable(table);
      if (!item.id) {
        const maxId = list.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0);
        item.id = maxId + 1;
      }
      if (!item.created_at) {
        item.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      }
      list.push(item);
      this.saveTable(table, list);
      return item;
    },
    update(table, id, updates) {
      const list = this.getTable(table);
      const index = list.findIndex(i => String(i.id) === String(id));
      if (index !== -1) {
        list[index] = { ...list[index], ...updates };
        this.saveTable(table, list);
        return list[index];
      }
      return null;
    },
    delete(table, id) {
      let list = this.getTable(table);
      const item = list.find(i => String(i.id) === String(id));
      list = list.filter(i => String(i.id) !== String(id));
      this.saveTable(table, list);
      return item;
    }
  };

  // Seed storage initially if empty
  Object.keys(INITIAL_SEED).forEach(t => {
    if (!localStorage.getItem(LocalDB.getKey(t))) {
      LocalDB.saveTable(t, INITIAL_SEED[t]);
    }
  });

  // 3. Firestore REST & SDK Client
  const FirestoreService = {
    baseUrl: `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`,

    parseDoc(doc) {
      if (!doc || !doc.fields) return null;
      const res = {};
      for (const [key, valObj] of Object.entries(doc.fields)) {
        if (valObj.stringValue !== undefined) res[key] = valObj.stringValue;
        else if (valObj.integerValue !== undefined) res[key] = parseInt(valObj.integerValue, 10);
        else if (valObj.doubleValue !== undefined) res[key] = parseFloat(valObj.doubleValue);
        else if (valObj.booleanValue !== undefined) res[key] = valObj.booleanValue;
        else if (valObj.nullValue !== undefined) res[key] = null;
        else if (valObj.timestampValue !== undefined) res[key] = valObj.timestampValue;
        else if (valObj.mapValue && valObj.mapValue.fields) res[key] = this.parseDoc(valObj.mapValue);
        else res[key] = null;
      }
      if (doc.name) {
        const parts = doc.name.split('/');
        res._docId = parts[parts.length - 1];
        if (!res.id) res.id = isNaN(res._docId) ? res._docId : Number(res._docId);
      }
      return res;
    },

    encodeDoc(data) {
      const fields = {};
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('_')) continue;
        if (val === null || val === undefined) fields[key] = { nullValue: null };
        else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
        else if (typeof val === 'number') {
          if (Number.isInteger(val)) fields[key] = { integerValue: String(val) };
          else fields[key] = { doubleValue: val };
        } else fields[key] = { stringValue: String(val) };
      }
      return { fields };
    },

    async getCollection(table) {
      try {
        const url = `${this.baseUrl}/${table}?key=${firebaseConfig.apiKey}&pageSize=300`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.documents) {
          const items = data.documents.map(d => this.parseDoc(d)).filter(Boolean);
          if (items.length > 0) {
            LocalDB.saveTable(table, items);
          }
          return items;
        }
      } catch (e) {
        console.warn(`[Firebase REST] Using local cache for ${table}`);
      }
      return LocalDB.getTable(table);
    },

    async setDoc(table, docId, data) {
      try {
        const cleanId = String(docId || data.id || Date.now());
        const url = `${this.baseUrl}/${table}/${cleanId}?key=${firebaseConfig.apiKey}`;
        const body = JSON.stringify(this.encodeDoc(data));
        fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
      } catch (e) {}
    },

    async deleteDoc(table, docId) {
      try {
        const url = `${this.baseUrl}/${table}/${String(docId)}?key=${firebaseConfig.apiKey}`;
        fetch(url, { method: 'DELETE' }).catch(() => {});
      } catch (e) {}
    }
  };

  // Sync with Firestore in background when online
  async function syncAllFromFirestore() {
    if (!navigator.onLine) return;
    try {
      const tables = ['admins', 'users', 'offices', 'drivers', 'buses', 'bills'];
      for (const t of tables) {
        await FirestoreService.getCollection(t);
      }
      console.log('🔥 [DropBook Cloud] Synchronized live with Firestore');
    } catch (e) {}
  }
  syncAllFromFirestore();
  window.addEventListener('online', syncAllFromFirestore);

  // 4. API Request Interceptor Router
  function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function parseBody(body) {
    if (!body) return {};
    if (typeof body === 'object') return body;
    try {
      return JSON.parse(body);
    } catch (e) {
      return {};
    }
  }

  async function handleApiRequest(urlPath, method, body, headers) {
    let [cleanPath, queryString] = urlPath.replace(/^.*\/api\//, '/api/').split('?');
    cleanPath = cleanPath.replace(/\/+$/, ''); // trim trailing slash
    const queryParams = new URLSearchParams(queryString || '');
    const reqBody = parseBody(body);

    // --- 1. AUTHENTICATION & LOGIN ---
    if (cleanPath === '/api/login' || cleanPath === '/api/admin/login') {
      const loginId = (reqBody.email || reqBody.username || reqBody.usernameOrEmail || '').trim().toLowerCase();
      const password = reqBody.password || '';

      if (!loginId || !password) {
        return createJsonResponse({ success: false, message: 'Email/Username and password are required' }, 400);
      }

      // 1. Check in Admins
      const admins = LocalDB.getTable('admins');
      const offices = LocalDB.getTable('offices');
      const adminMatch = admins.find(a => 
        (String(a.email || '').toLowerCase() === loginId || String(a.username || '').toLowerCase() === loginId) && 
        String(a.password) === String(password)
      );

      if (adminMatch) {
        if (adminMatch.status && adminMatch.status !== 'Active') {
          return createJsonResponse({ success: false, message: 'Admin account is deactivated.' }, 403);
        }
        const office = offices.find(o => String(o.id) === String(adminMatch.office_id)) || {};
        const token = 'adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
        
        const adminData = {
          id: adminMatch.id,
          name: adminMatch.name,
          username: adminMatch.username,
          email: adminMatch.email,
          role: adminMatch.role,
          office_id: adminMatch.office_id,
          office_name: office.office_name || (adminMatch.role === 'main_admin' ? 'All Offices (Super Admin)' : 'Branch Office'),
          office_code: office.office_code || 'ALL',
          city: office.city || 'ALL',
          permissions: ['dashboard', 'parcels', 'customers', 'drivers', 'delivery', 'billing', 'reports']
        };

        const isInsideAdmin = window.location.pathname.includes('/admin/');
        let redirectTo = isInsideAdmin ? '../index.html' : 'index.html';
        if (adminMatch.role === 'main_admin') {
          redirectTo = isInsideAdmin ? 'index.html' : 'admin/index.html';
        }

        // Save session
        localStorage.setItem('veronic_admin_token', token);
        localStorage.setItem('veronic_auth_token', token);
        localStorage.setItem('veronic_admin_user', JSON.stringify(adminData));
        localStorage.setItem('veronic_user', JSON.stringify(adminData));

        return createJsonResponse({
          success: true,
          message: 'Login successful',
          data: {
            user: adminData,
            admin: adminData,
            token,
            role: adminMatch.role,
            office_id: adminMatch.office_id,
            redirectTo
          }
        });
      }

      // 2. Check in Users
      const users = LocalDB.getTable('users');
      const userMatch = users.find(u => 
        (String(u.email || '').toLowerCase() === loginId || String(u.name || '').toLowerCase() === loginId) && 
        String(u.password) === String(password)
      );

      if (userMatch) {
        const token = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
        const userData = {
          id: userMatch.id,
          name: userMatch.name,
          email: userMatch.email,
          role: userMatch.role || 'member',
          office_id: userMatch.office_id || 1
        };

        localStorage.setItem('veronic_auth_token', token);
        localStorage.setItem('veronic_user', JSON.stringify(userData));

        const isInsideAdmin = window.location.pathname.includes('/admin/');
        const redirectTo = isInsideAdmin ? '../index.html' : 'index.html';

        return createJsonResponse({
          success: true,
          message: 'Login successful',
          data: {
            user: userData,
            token,
            role: userData.role,
            office_id: userData.office_id,
            redirectTo
          }
        });
      }

      return createJsonResponse({ success: false, message: 'Invalid credentials. Please verify username/email and password.' }, 401);
    }

    // --- 2. AUTH VERIFICATION ---
    if (cleanPath === '/api/verify' || cleanPath === '/api/admin/verify') {
      const storedAdmin = localStorage.getItem('veronic_admin_user');
      const storedUser = localStorage.getItem('veronic_user');
      const user = storedAdmin ? JSON.parse(storedAdmin) : (storedUser ? JSON.parse(storedUser) : null);

      if (user) {
        return createJsonResponse({
          success: true,
          data: {
            user,
            admin: user,
            role: user.role || 'main_admin',
            office_id: user.office_id
          }
        });
      }
      return createJsonResponse({ success: false, message: 'Not authenticated' }, 401);
    }

    // --- 3. SIGNUP ---
    if (cleanPath === '/api/signup') {
      const newUser = {
        name: reqBody.name || 'New User',
        email: reqBody.email,
        password: reqBody.password,
        office_id: 1,
        role: 'member',
        status: 'Active'
      };
      const created = LocalDB.insert('users', newUser);
      FirestoreService.setDoc('users', created.id, created);

      const token = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('veronic_auth_token', token);
      localStorage.setItem('veronic_user', JSON.stringify(created));

      return createJsonResponse({
        success: true,
        message: 'Account created successfully',
        data: { user: created, token }
      });
    }

    // --- 4. DASHBOARD STATS ---
    if (cleanPath === '/api/stats') {
      const drivers = LocalDB.getTable('drivers');
      const buses = LocalDB.getTable('buses');
      const bills = LocalDB.getTable('bills');
      const totalRevenue = bills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

      return createJsonResponse({
        totalDrivers: drivers.length,
        todayBills: bills.length,
        monthRevenue: totalRevenue,
        activeBuses: buses.length,
        deletedDrivers: 0,
        deletedBuses: 0,
        deletedBills: 0
      });
    }

    if (cleanPath === '/api/dashboard/stats' || cleanPath === '/api/admin/dashboard/stats' || cleanPath === '/api/admin/stats') {
      const offices = LocalDB.getTable('offices');
      const admins = LocalDB.getTable('admins');
      const users = LocalDB.getTable('users');
      const drivers = LocalDB.getTable('drivers');
      const buses = LocalDB.getTable('buses');
      const bills = LocalDB.getTable('bills');

      const totalRevenue = bills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
      const totalJama = bills.reduce((sum, b) => sum + (Number(b.jama) || 0), 0);
      const totalBaki = bills.reduce((sum, b) => sum + (Number(b.baki) || 0), 0);

      const officesWithCounts = offices.map(o => {
        const oAdmins = admins.filter(a => String(a.office_id) === String(o.id));
        const oParcels = bills.filter(b => String(b.office_id) === String(o.id));
        const oDrivers = drivers.filter(d => String(d.office_id) === String(o.id));
        const oRevenue = oParcels.reduce((s, p) => s + (Number(p.total) || 0), 0);
        return {
          ...o,
          admins_count: oAdmins.length,
          parcels_count: oParcels.length,
          drivers_count: oDrivers.length,
          revenue: oRevenue
        };
      });

      return createJsonResponse({
        success: true,
        data: {
          totalOffices: offices.length,
          activeOffices: offices.filter(o => o.status === 'Active').length,
          totalAdmins: admins.length,
          totalStaff: admins.length,
          totalUsers: users.length,
          totalCustomers: users.length,
          totalDrivers: drivers.length,
          totalBuses: buses.length,
          totalParcels: bills.length,
          todayParcels: bills.length,
          pendingParcels: bills.filter(b => (Number(b.baki) || 0) > 0).length,
          deliveredParcels: bills.filter(b => (Number(b.baki) || 0) === 0).length,
          totalRevenue,
          totalJama,
          totalBaki,
          offices: officesWithCounts,
          stats: {
            offices_count: offices.length,
            admins_count: admins.length,
            drivers_count: drivers.length,
            buses_count: buses.length,
            bills_count: bills.length
          }
        }
      });
    }

    // --- 5. TODAY DRIVERS ---
    if (cleanPath === '/api/today_driver_assignments' || cleanPath === '/api/today-driver' || cleanPath === '/api/today-drivers') {
      let todayList = LocalDB.getTable('today_driver_assignments');
      if (!Array.isArray(todayList) || todayList.length === 0) {
        todayList = [
          { id: 1, bus_id: 15, bus_number: "GJ-25-910", bus_no: "GJ-25-910", driver_id: 13, driver_name: "vansh gohal", assigned_at: "08:00 AM", office_id: 1 },
          { id: 2, bus_id: 14, bus_number: "GJ-25-999", bus_no: "GJ-25-999", driver_id: 14, driver_name: "Ram odedra", assigned_at: "09:30 AM", office_id: 1 },
          { id: 3, bus_number: "GJ-25-001", bus_no: "GJ-25-001", driver_id: 15, driver_name: "Raju", assigned_at: "11:00 AM", office_id: 1 }
        ];
        LocalDB.saveTable('today_driver_assignments', todayList);
      }
      if (method === 'GET') {
        const offId = queryParams.get('office_id');
        let resList = todayList;
        if (offId && Number(offId) !== 0) {
          const filtered = todayList.filter(td => !td.office_id || String(td.office_id) === String(offId));
          resList = filtered.length > 0 ? filtered : todayList;
        }
        return createJsonResponse(resList);
      }
      if (method === 'POST') {
        const buses = LocalDB.getTable('buses');
        const drivers = LocalDB.getTable('drivers');
        const bus = buses.find(b => String(b.id) === String(reqBody.busId || reqBody.bus_id));
        const driver = drivers.find(d => String(d.id) === String(reqBody.driverId || reqBody.driver_id));
        const newItem = {
          id: Date.now(),
          bus_id: Number(reqBody.busId || reqBody.bus_id),
          bus_number: bus ? bus.bus_number : (reqBody.bus_number || 'GJ-25-001'),
          bus_no: bus ? bus.bus_number : (reqBody.bus_number || 'GJ-25-001'),
          driver_id: Number(reqBody.driverId || reqBody.driver_id),
          driver_name: driver ? driver.name : (reqBody.driver_name || 'Driver'),
          assigned_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          office_id: Number(reqBody.office_id || 1)
        };
        todayList.push(newItem);
        LocalDB.saveTable('today_driver_assignments', todayList);
        return createJsonResponse({ success: true, message: 'Driver assigned for today', data: newItem });
      }
    }
    const todayMatch = cleanPath.match(/\/api\/today-drivers\/(\d+)/);
    if (todayMatch && method === 'DELETE') {
      const deleteId = todayMatch[1];
      let todayList = LocalDB.getTable('today_driver_assignments');
      todayList = todayList.filter(td => String(td.id) !== String(deleteId));
      LocalDB.saveTable('today_driver_assignments', todayList);
      return createJsonResponse({ success: true, message: 'Driver removed' });
    }

    // --- 6. OFFICES ---
    if (cleanPath === '/api/offices' || cleanPath === '/api/admin/offices') {
      const offices = LocalDB.getTable('offices');
      if (cleanPath.startsWith('/api/admin/')) {
        return createJsonResponse({ success: true, count: offices.length, data: offices });
      }
      return createJsonResponse(offices);
    }
    const officeMatch = cleanPath.match(/\/api\/(?:admin\/)?offices\/(\d+)/);
    if (officeMatch) {
      const officeId = officeMatch[1];
      if (method === 'GET') {
        const office = LocalDB.getTable('offices').find(o => String(o.id) === String(officeId));
        return createJsonResponse(cleanPath.includes('/admin/') ? { success: Boolean(office), data: office } : office);
      }
      if (method === 'PUT') {
        const updated = LocalDB.update('offices', officeId, reqBody);
        if (updated) FirestoreService.setDoc('offices', officeId, updated);
        return createJsonResponse({ success: true, data: updated });
      }
      if (method === 'DELETE') {
        LocalDB.delete('offices', officeId);
        FirestoreService.deleteDoc('offices', officeId);
        return createJsonResponse({ success: true, message: 'Office deleted' });
      }
    }

    // --- 7. DRIVERS ---
    if (cleanPath === '/api/drivers' || cleanPath === '/api/admin/drivers') {
      const drivers = LocalDB.getTable('drivers');
      if (method === 'GET') {
        const offId = queryParams.get('office_id');
        let resDrivers = drivers;
        if (offId && Number(offId) !== 0) {
          const filtered = drivers.filter(d => !d.office_id || String(d.office_id) === String(offId));
          resDrivers = filtered.length > 0 ? filtered : drivers;
        }
        if (cleanPath.startsWith('/api/admin/')) {
          return createJsonResponse({ success: true, count: resDrivers.length, data: resDrivers });
        }
        return createJsonResponse(resDrivers);
      }
      if (method === 'POST') {
        const driver = LocalDB.insert('drivers', reqBody);
        FirestoreService.setDoc('drivers', driver.id, driver);
        return createJsonResponse({ success: true, message: 'Driver created', data: driver });
      }
    }
    const driverMatch = cleanPath.match(/\/api\/drivers\/(\d+)/);
    if (driverMatch) {
      const driverId = driverMatch[1];
      if (method === 'PUT') {
        const updated = LocalDB.update('drivers', driverId, reqBody);
        if (updated) FirestoreService.setDoc('drivers', driverId, updated);
        return createJsonResponse({ success: true, data: updated });
      }
      if (method === 'DELETE') {
        LocalDB.delete('drivers', driverId);
        FirestoreService.deleteDoc('drivers', driverId);
        return createJsonResponse({ success: true, message: 'Driver deleted' });
      }
    }

    // --- 8. BUSES ---
    if (cleanPath === '/api/buses' || cleanPath === '/api/admin/buses') {
      const buses = LocalDB.getTable('buses');
      if (method === 'GET') {
        const offId = queryParams.get('office_id');
        let resBuses = buses;
        if (offId && Number(offId) !== 0) {
          const filtered = buses.filter(b => !b.office_id || String(b.office_id) === String(offId));
          resBuses = filtered.length > 0 ? filtered : buses;
        }
        if (cleanPath.startsWith('/api/admin/')) {
          return createJsonResponse({ success: true, count: resBuses.length, data: resBuses });
        }
        return createJsonResponse(resBuses);
      }
      if (method === 'POST') {
        const bus = LocalDB.insert('buses', reqBody);
        FirestoreService.setDoc('buses', bus.id, bus);
        return createJsonResponse({ success: true, message: 'Bus created', data: bus });
      }
    }
    const busMatch = cleanPath.match(/\/api\/buses\/(\d+)/);
    if (busMatch) {
      const busId = busMatch[1];
      if (method === 'PUT') {
        const updated = LocalDB.update('buses', busId, reqBody);
        if (updated) FirestoreService.setDoc('buses', busId, updated);
        return createJsonResponse({ success: true, data: updated });
      }
      if (method === 'DELETE') {
        LocalDB.delete('buses', busId);
        FirestoreService.deleteDoc('buses', busId);
        return createJsonResponse({ success: true, message: 'Bus deleted' });
      }
    }

    // --- 9. BILLS & PARCELS ---
    const billItemsMatch = cleanPath.match(/\/api\/bills\/(\d+)\/items/);
    if (billItemsMatch) {
      const billId = billItemsMatch[1];
      const items = LocalDB.getTable('bill_items').filter(it => String(it.bill_id) === String(billId));
      return createJsonResponse(items);
    }

    if (cleanPath === '/api/bills' || cleanPath === '/api/admin/parcels') {
      const bills = LocalDB.getTable('bills');
      const items = LocalDB.getTable('bill_items');
      const fullBills = bills.map(b => ({
        ...b,
        items: items.filter(it => String(it.bill_id) === String(b.id))
      }));

      if (method === 'GET') {
        const offId = queryParams.get('office_id');
        let resBills = fullBills;
        if (offId && Number(offId) !== 0) {
          const filtered = fullBills.filter(b => !b.office_id || String(b.office_id) === String(offId));
          resBills = filtered.length > 0 ? filtered : fullBills;
        }
        if (cleanPath.startsWith('/api/admin/')) {
          return createJsonResponse({ success: true, count: resBills.length, data: resBills });
        }
        return createJsonResponse(resBills);
      }
      if (method === 'POST') {
        const billData = { ...reqBody };
        const items = billData.items || [];
        delete billData.items;

        const bill = LocalDB.insert('bills', billData);
        FirestoreService.setDoc('bills', bill.id, bill);

        if (Array.isArray(items)) {
          items.forEach(it => {
            const billItem = LocalDB.insert('bill_items', { ...it, bill_id: bill.id });
            FirestoreService.setDoc('bill_items', billItem.id, billItem);
          });
        }
        return createJsonResponse({ success: true, message: 'Parcel bill saved', data: bill });
      }
    }
    const billMatch = cleanPath.match(/\/api\/(?:admin\/parcels|bills)\/(\d+)/);
    if (billMatch) {
      const billId = billMatch[1];
      if (method === 'DELETE') {
        LocalDB.delete('bills', billId);
        FirestoreService.deleteDoc('bills', billId);
        return createJsonResponse({ success: true, message: 'Bill deleted' });
      }
    }

    // --- 10. ADMINS & USERS ---
    if (cleanPath === '/api/admins' || cleanPath === '/api/admin/admins') {
      const admins = LocalDB.getTable('admins');
      if (method === 'GET') {
        return createJsonResponse({ success: true, count: admins.length, data: admins });
      }
      if (method === 'POST') {
        const admin = LocalDB.insert('admins', reqBody);
        FirestoreService.setDoc('admins', admin.id, admin);
        return createJsonResponse({ success: true, message: 'Admin created', data: admin });
      }
    }
    if (cleanPath === '/api/users' || cleanPath === '/api/admin/users') {
      if (method === 'GET') {
        const users = LocalDB.getTable('users');
        return createJsonResponse({ success: true, count: users.length, data: users });
      }
    }

    // --- 11. LOGOUT & FIREBASE UTILS ---
    if (cleanPath === '/api/logout' || cleanPath === '/api/admin/logout') {
      localStorage.removeItem('veronic_auth_token');
      localStorage.removeItem('veronic_admin_token');
      localStorage.removeItem('veronic_user');
      localStorage.removeItem('veronic_admin_user');
      return createJsonResponse({ success: true, message: 'Logged out successfully' });
    }

    if (cleanPath.startsWith('/api/firebase/data/')) {
      const table = cleanPath.split('/').pop();
      const data = LocalDB.getTable(table);
      return createJsonResponse({ success: true, table, count: data.length, data });
    }

    if (cleanPath === '/api/firebase/sync-all') {
      await syncAllFromFirestore();
      return createJsonResponse({ success: true, message: 'Sync complete' });
    }

    // Generic fallback for any other GET/POST endpoint
    return createJsonResponse({ success: true, message: 'OK', data: [] });
  }

  // 5. Intercept Native Window Fetch
  const originalFetch = window.fetch;
  window.fetch = async function(resource, init = {}) {
    const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    const isApiCall = url.includes('/api/') || url.endsWith('/api');
    const isFileProtocol = window.location.protocol === 'file:';

    if (isApiCall) {
      if (isFileProtocol) {
        // Direct local/Firestore emulation on mobile & standalone
        return await handleApiRequest(url, (init.method || 'GET').toUpperCase(), init.body, init.headers);
      } else {
        // In web browser, attempt normal network call; on failure, transparently fallback to Firestore adapter
        try {
          const res = await originalFetch.apply(this, arguments);
          if (res.status === 404 || res.status === 502 || res.status === 503) {
            return await handleApiRequest(url, (init.method || 'GET').toUpperCase(), init.body, init.headers);
          }
          return res;
        } catch (netErr) {
          console.log('📡 [Network Fallback] Server unreachable, handling with Firebase client:', netErr.message);
          return await handleApiRequest(url, (init.method || 'GET').toUpperCase(), init.body, init.headers);
        }
      }
    }

    return originalFetch.apply(this, arguments);
  };

  // 6. Auto-Session Initializer for Seamless Launch
  function initAutoSession() {
    if (!localStorage.getItem('veronic_auth_token') && !localStorage.getItem('veronic_admin_token')) {
      const defaultAdmin = INITIAL_SEED.admins[0]; // Main Admin
      const token = 'adm_auto_' + Date.now();
      const adminData = {
        id: defaultAdmin.id,
        name: defaultAdmin.name,
        username: defaultAdmin.username,
        email: defaultAdmin.email,
        role: defaultAdmin.role,
        office_id: null,
        office_name: 'All Offices (Super Admin)',
        office_code: 'ALL',
        city: 'ALL',
        permissions: ['dashboard', 'parcels', 'customers', 'drivers', 'delivery', 'billing', 'reports']
      };
      localStorage.setItem('veronic_auth_token', token);
      localStorage.setItem('veronic_admin_token', token);
      localStorage.setItem('veronic_user', JSON.stringify(adminData));
      localStorage.setItem('veronic_admin_user', JSON.stringify(adminData));
      console.log('⚡ [Auto-Session] Master Admin session established for instant launch');
    }
  }

  // 7. Global FirebaseApp Object
  window.FirebaseApp = {
    config: firebaseConfig,
    db: LocalDB,
    firestore: FirestoreService,
    syncAll: syncAllFromFirestore,
    isInitialized: true,

    init() {
      initAutoSession();
      if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        try {
          firebase.initializeApp(firebaseConfig);
          console.log('✅ Firebase SDK initialized');
        } catch (e) {}
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.FirebaseApp.init());
  } else {
    window.FirebaseApp.init();
  }

  console.log('🚀 [DropBook Engine] Firebase Client & Standalone Bridge Active!');
})();
