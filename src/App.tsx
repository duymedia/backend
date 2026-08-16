import React, { lazy, Suspense, useState, useEffect } from 'react';
import { mockProducts, mockOrders, mockCampaigns, mockReviews } from './data/mockData';
import { Product, Category, Order, Customer, SupportTicket, MarketingCampaign, ProductReview } from './types';
import LoginPage, { type AuthSession } from './components/auth';
import Sidebar from './components/layout/Sidebar';
import CommandPalette from './components/layout/CommandPalette';
import { productsApi, categoriesApi, usersApi, aiApi } from './lib/api';
import { exportProductsToExcel } from './lib/productExcel';
import { exportOrdersToExcel } from './lib/orderExcel';

const AnalyticsView = lazy(() => import('./components/features/analytics'));
const BannersView = lazy(() => import('./components/features/banners'));
const CategoriesView = lazy(() => import('./components/features/categories/CategoriesView'));
const CustomerDrawer = lazy(() => import('./components/features/customers/CustomerDrawer'));
const CustomersPage = lazy(() => import('./components/pages/customers'));
const MarketingCenter = lazy(() => import('./components/features/marketing'));
const NewProductModal = lazy(() => import('./components/pages/new-product-modal'));
const NotificationsView = lazy(() => import('./components/features/notifications'));
const OrderDrawer = lazy(() => import('./components/features/orders'));
const OrdersPage = lazy(() => import('./components/pages/orders'));
const ProductsPage = lazy(() => import('./components/pages/products'));
const ProductDrawer = lazy(() => import('./components/features/products'));
const ReviewsView = lazy(() => import('./components/features/reviews'));
const SettingsView = lazy(() => import('./components/features/settings'));
const SupportCenter = lazy(() => import('./components/features/support'));
const UserForm = lazy(() => import('./components/features/customers/UserForm'));

type AuthPortalRole = 'admin' | 'seller';

const AUTH_STORAGE_KEY = 'omni_auth_session';
const LEGACY_AUTH_STORAGE_KEY = 'omni_auth_user';
const ADMIN_BASE_PATH = '/admin';

const adminPath = (path = '/') => {
  const normalizedPath = path === '/' ? '' : `/${path.replace(/^\/+/, '')}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
};

const stripAdminBasePath = (pathname: string) => {
  if (!pathname.startsWith(ADMIN_BASE_PATH)) return pathname;
  return pathname.slice(ADMIN_BASE_PATH.length) || '/';
};

const getLoginRoleFromPath = (): AuthPortalRole | null => {
  const path = window.location.pathname.toLowerCase();
  if (path === '/admin/auth/login') return 'admin';
  if (path === '/admin/seller/auth/login') return 'seller';
  return null;
};

const getLoginPathForRole = (role: AuthPortalRole) =>
  role === 'admin' ? adminPath('/auth/login') : adminPath('/seller/auth/login');

const readStoredAuthSession = (): AuthSession | null => {
  try {
    const cachedSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (cachedSession) {
      const parsed = JSON.parse(cachedSession);
      if (parsed?.token && parsed?.user?.email) {
        return parsed as AuthSession;
      }
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return null;
};

function PageLoading() {
  return (
    <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden px-4 pb-6 pt-5 md:px-8 md:pt-8 xl:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1480px] flex-col space-y-6">
        <div className="h-24 rounded-2xl border border-blue-100/60 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-5">
          <div className="h-4 w-52 animate-pulse rounded-full bg-slate-200/80" />
          <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="m-4 h-3 w-20 rounded-full bg-slate-100" />
              <div className="mx-4 mt-4 h-6 w-24 rounded-full bg-slate-200" />
              <div className="mx-4 mt-4 h-3 w-28 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const loginRoleFromPath = getLoginRoleFromPath();
  const requiredLoginRole: AuthPortalRole = loginRoleFromPath || 'admin';

  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readStoredAuthSession());

  useEffect(() => {
    const cachedSession = readStoredAuthSession();
    if (cachedSession?.user?.email) {
      usersApi.getByEmail(cachedSession.user.email)
        .then(data => {
          if (data.ok) {
            const refreshedSession = { ...cachedSession, user: data.user };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedSession));
            setAuthSession(refreshedSession);
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
            setAuthSession(null);
          }
        })
        .catch(() => {
          setAuthSession(cachedSession);
        });

      return;
    }

    const cachedUser = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (cachedUser) {
      try {
        const { email } = JSON.parse(cachedUser);
        if (email) {
          usersApi.getByEmail(email)
            .then(data => {
              if (data.ok) {
                const migratedSession = { token: '', user: data.user };
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(migratedSession));
                localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
                setAuthSession(migratedSession);
              } else {
                localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
              }
            });
        }
      } catch {
        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      }
    }
  }, []);

  const getSectionFromPath = () => {
    const path = stripAdminBasePath(window.location.pathname).replace(/^\//, '') || 'dashboard';
    return ['dashboard', 'products', 'categories', 'banners', 'orders', 'customers', 'reviews', 'support', 'marketing', 'notifications', 'settings'].includes(path) ? path : 'dashboard';
  };

  const [currentSection, setCurrentSection] = useState(getSectionFromPath);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Dynamic categories state with Vietnamese defaults and object structure
  const [categories, setCategories] = useState<Category[]>(() => {
    const cached = localStorage.getItem('omni_categories_v2');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    // Fallback/Migration
    const oldCached = localStorage.getItem('omni_categories');
    let names = ['Thời trang', 'Điện tử', 'Thể thao', 'Phụ kiện', 'Gia dụng', 'Activewear', 'Electronics', 'Fitness', 'Accessories'];
    if (oldCached) {
      try {
        const parsed = JSON.parse(oldCached);
        if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
          names = parsed;
        }
      } catch (e) {}
    }

    const now = new Date().toISOString();
    return names.map((name, idx) => ({
      id: `CAT-${101 + idx}`,
      name,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }));
  });

  useEffect(() => {
    localStorage.setItem('omni_categories_v2', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentSection(getSectionFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (section: string) => {
    const targetPath = section === 'dashboard' ? adminPath() : adminPath(section);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setCurrentSection(section);
  };

  const handleLogin = (session: AuthSession) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    setAuthSession(session);
    window.history.replaceState(null, '', adminPath());
    setCurrentSection('dashboard');
  };

  const handleLogout = () => {
    const nextRole: AuthPortalRole = authSession?.user.role === 'seller' ? 'seller' : 'admin';
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    setAuthSession(null);
    setIsCommandPaletteOpen(false);
    window.history.replaceState(null, '', getLoginPathForRole(nextRole));
  };

  // Core synchronized application state
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [users, setUsers] = useState<Customer[]>([]);
  useEffect(() => {
    categoriesApi.list()
      .then(data => { if (data.ok) setCategories(data.categories); });

    productsApi.list()
      .then(data => { if (data.ok) setProducts(data.products); });

    usersApi.list()
      .then(data => { if (data.ok) setUsers(data.users); });
  }, []);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>(mockCampaigns);
  const [reviews, setReviews] = useState<ProductReview[]>(mockReviews);

  // Drawer overlays states
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Customer | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // New product modal
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);

  // Search & Filter state for table lists
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('All');
  const [custSearch, setCustSearch] = useState('');
  const [custTierFilter, setCustTierFilter] = useState('All');

  // Bulk selections for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Persistent storage synchronizer



  useEffect(() => {
    if (!authSession && !getLoginRoleFromPath()) {
      window.history.replaceState(null, '', getLoginPathForRole('admin'));
    }
  }, [authSession]);

  // Global Keyboard shortcuts (CMD + K for search panel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers for state updates from drawer modifications
  const handleSaveProduct = async (updated: Product) => {
    try {
      const data = await productsApi.update(updated.id, updated);
      if (!data.ok) throw new Error(data.message || 'Failed to update product');
      setProducts(prev => prev.map(p => p.id === updated.id ? data.product : p));
      setActiveProduct(data.product);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleSaveOrder = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const handleSaveTicket = (updated: SupportTicket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  // Create campaigns
  const handleAddCampaign = (camp: MarketingCampaign) => {
    setCampaigns(prev => [camp, ...prev]);
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const handleToggleProductStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'draft' : 'active';
    const product = products.find(p => p.id === id);
    if (!product) return;

    try {
      const data = await productsApi.update(id, { ...product, status: nextStatus });
      if (!data.ok) throw new Error(data.message || 'Failed to update product');
      setProducts(prev => prev.map(p => p.id === id ? data.product : p));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      setProductToDelete(product);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      const data = await productsApi.remove(productToDelete.id);
      if (!data.ok) throw new Error(data.message || 'Failed to delete product');
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      setSelectedProductIds(prev => prev.filter(id => id !== productToDelete.id));
      if (activeProduct?.id === productToDelete.id) setActiveProduct(null);
      setProductToDelete(null);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateUser = (newUser: Customer) => {
    usersApi.create(newUser)
      .then(data => {
        if (data.ok) {
          setUsers(prev => [data.user, ...prev]);
          setIsNewUserOpen(false);
        } else {
          alert(`Error: ${data.message}`);
        }
      });
  };

  const handleUpdateUser = async (updatedUser: Customer) => {
    try {
      const data = await usersApi.update(updatedUser.id, updatedUser);
      if (data.ok) {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? data.user : u));
        setEditingUser(null);
        setActiveCustomer(prev => prev?.id === updatedUser.id ? data.user : prev);
        return data.user;
      }
      alert(`Error: ${data.message}`);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }

    return null;
  };

  const handleBulkUpdateUsers = async (userIds: string[], status: NonNullable<Customer['status']>) => {
    const selectedUsers = users.filter(user => userIds.includes(user.id));

    try {
      const updatedUsers = await Promise.all(
        selectedUsers.map(async (user) => {
          const data = await usersApi.update(user.id, { ...user, status });
          if (!data.ok) throw new Error(data.message || 'Failed to update user');
          return data.user as Customer;
        })
      );

      setUsers(prev => prev.map(user => updatedUsers.find(updated => updated.id === user.id) || user));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleBulkDeleteUsers = async (userIds: string[]) => {
    if (userIds.length === 0) return false;

    const confirmed = window.confirm(`Bạn có chắc muốn xóa ${userIds.length} khách hàng đã chọn?`);
    if (!confirmed) return false;

    try {
      await Promise.all(
        userIds.map(async (userId) => {
          const data = await usersApi.remove(userId);
          if (!data.ok) throw new Error(data.message || 'Failed to delete user');
        })
      );

      setUsers(prev => prev.filter(user => !userIds.includes(user.id)));
      if (activeCustomer && userIds.includes(activeCustomer.id)) {
        setActiveCustomer(null);
      }
      if (editingUser && userIds.includes(editingUser.id)) {
        setEditingUser(null);
      }
      return true;
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      return false;
    }
  };

  const handleToggleCustomerStatus = (customer: Customer) => {
    handleBulkUpdateUsers([customer.id], customer.status === 'active' ? 'blocked' : 'active');
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Bạn có chắc muốn xóa khách hàng này?')) {
      usersApi.remove(userId)
        .then(data => {
          if (data.ok) {
            setUsers(prev => prev.filter(u => u.id !== userId));
          } else {
            alert(`Error: ${data.message}`);
          }
        });
    }
  };

  // Quick excel export
  const handleExportExcel = async (ordersToExport?: Order[]) => {
    try {
      if (ordersToExport) {
        await exportOrdersToExcel(ordersToExport);
        return;
      }

      await exportProductsToExcel(filteredProducts);
    } catch (error: any) {
      alert(`Không thể xuất Excel: ${error.message || 'Vui lòng thử lại.'}`);
    }
  };

  // Filtering datasets
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase());
    const matchCat = prodCatFilter === 'All' || p.category === prodCatFilter;
    return matchSearch && matchCat;
  });

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(custSearch.toLowerCase()) || u.email.toLowerCase().includes(custSearch.toLowerCase());
    const matchRole = custTierFilter === 'All' || u.role === custTierFilter;
    return matchSearch && matchRole;
  });

  const userInitials = authSession?.user.name
    .split(' ')
    .filter(Boolean)
    .map(name => name[0])
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'A';

  const sectionTitle =
    currentSection === 'dashboard' ? 'Bàn Điều Khiển Trung Tâm' :
    currentSection === 'products' ? 'Danh Mục Sản Phẩm & Tồn Kho' :
    currentSection === 'categories' ? 'Quản Lý Danh Mục Phân Loại' :
    currentSection === 'orders' ? 'Quản Lý Nhật Ký Đơn Hàng' :
    currentSection === 'customers' ? 'Khách Hàng & Hành Trình Trải Nghiệm' :
    currentSection === 'reviews' ? 'Quản Lý Đánh Giá Khách Hàng' :
    currentSection === 'banners' ? 'Quản lý banner trang chủ' :
    currentSection === 'marketing' ? 'Trung Tâm Tiếp Thị & Chiến Dịch' :
    currentSection === 'support' ? 'Tổng Đài Hỗ Trợ Khách Hàng AI' :
    currentSection === 'settings' ? 'Thiết Lập Thông Số SaaS' :
    'Bàn Điều Khiển Trung Tâm';

  if (!authSession || (loginRoleFromPath && authSession.user.role !== loginRoleFromPath)) {
    return <LoginPage onLogin={handleLogin} requiredRole={requiredLoginRole} />;
  }

  return (
    <div className="analytics-typography min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-[#0F172A] font-sans antialiased">
      {/* Permanent or mobile sidebar overlay */}
      <Sidebar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onLogout={handleLogout}
        userEmail={authSession.user.email}
        userName={authSession.user.name}
        userRole={authSession.user.role}
        mobileTitle={sectionTitle}
      />

      <Suspense fallback={<PageLoading />}>
      {/* Main viewport area */}
      <main className="flex min-h-screen flex-1 flex-col overflow-x-hidden px-4 pb-6 pt-5 md:px-8 md:pt-8 xl:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1480px] flex-col space-y-6">

        {/* CORE ANALYTICS VIEW */}
        {currentSection === 'dashboard' && (
          <AnalyticsView
            products={products}
            orders={orders}
            customers={users}
            tickets={tickets}
            onNavigate={handleNavigate}
            onOpenAddProduct={() => setIsNewProductOpen(true)}
          />
        )}

        {/* PRODUCTS VIEW */}
        {currentSection === 'products' && (
          <ProductsPage
            categories={categories}
            products={products}
            onSelectProduct={setActiveProduct}
            onOpenNewProduct={() => setIsNewProductOpen(true)}
            onProductsChanged={setProducts}
          />
        )}

        {/* ORDERS VIEW */}
        {currentSection === 'orders' && (
          <OrdersPage
            orders={orders}
            onExportExcel={handleExportExcel}
            onSelectOrder={setActiveOrder}
          />
        )}

        {/* CUSTOMERS VIEW */}
        {currentSection === 'customers' && (
          <CustomersPage
            filteredUsers={filteredUsers}
            custSearch={custSearch}
            setCustSearch={setCustSearch}
            custTierFilter={custTierFilter}
            setCustTierFilter={setCustTierFilter}
            onOpenNewUser={() => setIsNewUserOpen(true)}
            onSelectCustomer={setActiveCustomer}
            onEditUser={setEditingUser}
            onDeleteUser={handleDeleteUser}
            onBulkUpdateUsers={handleBulkUpdateUsers}
            onBulkDeleteUsers={handleBulkDeleteUsers}
            onToggleCustomerStatus={handleToggleCustomerStatus}
          />
        )}

        {/* MARKETING VIEW */}
        {currentSection === 'marketing' && (
          <MarketingCenter
            campaigns={campaigns}
            onAddCampaign={handleAddCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            customers={users}
          />
        )}

        {currentSection === 'notifications' && (
          <NotificationsView
            users={users}
            currentUserId={authSession.user.id}
          />
        )}

        {/* SUPPORT TICKET VIEW */}
        {currentSection === 'support' && (
          <SupportCenter
            tickets={tickets}
            onUpdateTicket={handleSaveTicket}
            onReplaceTickets={setTickets}
            products={products}
          />
        )}

        {/* REVIEWS MANAGEMENT VIEW */}
        {currentSection === 'reviews' && (
          <ReviewsView
            reviews={reviews}
            setReviews={setReviews}
            products={products}
          />
        )}

        {/* CATEGORIES MANAGEMENT VIEW */}
        {currentSection === 'categories' && (
          <CategoriesView
            categories={categories}
            setCategories={setCategories}
            products={products}
            setProducts={setProducts}
          />
        )}

        {currentSection === 'banners' && (
          <BannersView categories={categories} />
        )}

        {/* SYSTEM SETTINGS VIEW */}
        {currentSection === 'settings' && (
          <SettingsView />
        )}

        {/* STATUS BAR */}
        <footer className="mt-auto flex min-h-12 flex-col items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-6 py-2 text-[11px] text-[#64748B] shadow-sm md:flex-row">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <span className="flex items-center font-bold text-[#16A34A] uppercase tracking-wide">
              <span className="w-2.5 h-2.5 bg-[#16A34A] rounded-full mr-1.5 animate-pulse"></span>
              Hệ thống trực tuyến
            </span>
            <span className="border-l border-slate-200 pl-4">Độ trễ máy chủ: 24ms</span>
            <span className="border-l border-slate-200 pl-4">Thời gian đồng bộ: 0.8s</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#2563EB] cursor-pointer transition-colors font-semibold">Chính sách Bảo mật</span>
            <span className="hover:text-[#2563EB] cursor-pointer transition-colors font-semibold">Tài liệu API</span>
            <span className="font-bold text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded-md">v4.8.2-stable</span>
          </div>
        </footer>
        </div>
      </main>

      {/* DRAWERS & SIDE PANELS OVERLAYS */}
      <ProductDrawer
        product={activeProduct}
        isOpen={activeProduct !== null}
        onClose={() => setActiveProduct(null)}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
        categories={categories.map(c => c.name)}
      />

      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <span className="text-xl font-black">!</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-950">Xac nhan xoa san pham?</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                San pham "{productToDelete.name}" se bi xoa khoi danh sach quan tri va database.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDeleteProduct}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
              >
                Xoa san pham
              </button>
              <button
                onClick={() => setProductToDelete(null)}
                className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
              >
                Huy bo
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderDrawer
        order={activeOrder}
        isOpen={activeOrder !== null}
        onClose={() => setActiveOrder(null)}
        onUpdateOrder={handleSaveOrder}
      />

      <CustomerDrawer
        customer={activeCustomer}
        isOpen={activeCustomer !== null}
        onClose={() => setActiveCustomer(null)}
        tickets={tickets}
        onSave={(updatedCustomer) => {
          handleUpdateUser(updatedCustomer);
        }}
        onDelete={handleDeleteUser}
      />

      {isNewUserOpen && (
        <UserForm
          onSave={handleCreateUser}
          onCancel={() => setIsNewUserOpen(false)}
        />
      )}

      {editingUser && (
        <UserForm
          user={editingUser}
          onSave={handleUpdateUser}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {/* COMMAND PALETTE POPUP */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentSection}
        products={products}
        orders={orders}
        onSelectProduct={setActiveProduct}
        onSelectOrder={setActiveOrder}
      />

      {/* NEW PRODUCT POPUP FORM MODAL */}
      {isNewProductOpen && (
        <NewProductModal
          categories={categories}
          onClose={() => setIsNewProductOpen(false)}
          onCreated={(product) => {
            setProducts(prev => [product, ...prev]);
            setIsNewProductOpen(false);
          }}
        />
      )}
      </Suspense>
    </div>
  );
}
