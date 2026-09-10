import { lazy, Suspense, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ContactRound,
  ListTodo,
  Ellipsis,
  Wallet,
  CalendarDays,
  Target,
  ChartNoAxesCombined,
  Megaphone,
  RefreshCw,
  Settings,
  BookOpen,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  Phone,
  MessageSquare,
  Package,
  Activity,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";
import { AutoCollections } from "./components/AutoCollections";
import { AutoVisits } from "./components/AutoVisits";
import { AutoCisappSync } from "./components/AutoCisappSync";
import { useAuth } from "./hooks";
import { Loading, ErrorBox } from "./components/ui";
import { emulator } from "./firebase";
import { modules } from "../shared/schema";
const ManagerHome = lazy(() => import("./pages/ManagerHome"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() =>
  import("./pages/Customers").then((m) => ({ default: m.CustomerDetail })),
);
const Workflows = lazy(() => import("./pages/Workflows"));
const Collections = lazy(() => import("./pages/Collections"));
const Targets = lazy(() => import("./pages/Targets"));
const Incentives = lazy(() => import("./pages/Incentives"));
const Performance = lazy(() => import("./pages/Performance"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Sync = lazy(() => import("./pages/Sync"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AdminGuide = lazy(() => import("./pages/AdminGuide"));
export default function App() {
  const { profile, loading } = useAuth();
  if (loading)
    return (
      <div className="boot">
        <div className="brand-icon">
          <ArrowUpRight />
        </div>
        <h2>Salesapp</h2>
        <Loading />
      </div>
    );
  if (!profile) return <Login />;
  if (profile.role === "Manager") return <Suspense fallback={<Loading />}><ManagerHome /></Suspense>;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="work/:kind" element={<WorkflowGuard />} />
          <Route path="collections" element={<CollectionsGuard />} />
          <Route path="targets" element={<Targets />} />
          <Route element={<AdminOnly />}>
            <Route path="incentives" element={<Incentives />} />
          </Route>
          <Route path="performance" element={<Performance />} />
          <Route path="more" element={<More />} />
          <Route element={<AdminOnly />}>
            <Route path="marketing" element={<Marketing />} />
            <Route path="sync" element={<Sync />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="guide" element={<AdminGuide />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
function AdminOnly() {
  return useAuth().profile?.role === "Admin" ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}
function WorkflowGuard() {
  const { profile } = useAuth();
  const location = useLocation();
  const kind = location.pathname.split("/").pop()!;
  if (!modules[kind] || (modules[kind].adminOnly && profile?.role !== "Admin") ||
    (profile?.role === "Staff" && kind === "followUps"))
    return <Navigate to="/" replace />;
  return <Workflows />;
}
function CollectionsGuard() {
  return useAuth().profile?.role === "Staff" ? <Navigate to="/work/tasks" replace /> : <Collections />;
}
const mainLinks = [
  ["/", "Today", LayoutDashboard],
  ["/customers", "Customers", Users],
  ["/work/leads", "Leads", ContactRound],
  ["/work/tasks", "Tasks", ListTodo],
] as const;
const workLinks = [
  ["/collections", "Collections", Wallet],
  ["/work/followUps", "Follow-ups", Phone],
  ["/work/visits", "Visits", CalendarDays],
  ["/work/opportunities", "Opportunities", Target],
  ["/work/customerRequirements", "Requirements", Package],
  ["/work/campaignAssignments", "Campaign work", Megaphone],
  ["/targets", "My target", Target],
  ["/performance", "Performance", ChartNoAxesCombined],
] as const;
function Layout() {
  const { profile, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const links = (items: readonly (readonly [string, string, any])[]) =>
    items.map(([to, title, Icon]) => (
      <NavLink key={to} end={to === "/"} to={to} onClick={() => setMenu(false)}>
        <Icon size={19} />
        {to === "/" && profile?.role === "Admin" ? "Overview" : title}
      </NavLink>
    ));
  return (
    <div className="app-shell">
      {menu && (
        <div className="sidebar-overlay" onClick={() => setMenu(false)} />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-icon">
            <ArrowUpRight size={24} />
          </span>
          Salesapp<span className="brand-dot">•</span>
        </Link>
        <div className="workspace-label">YOUR SALES WORKSPACE</div>
        <nav>
          {links(mainLinks)}
          <div className="nav-caption">WORK & GROWTH</div>
          {links(profile?.role === "Staff" ? workLinks.filter(([to]) => to !== "/collections" && to !== "/work/followUps") : workLinks)}
          <NavLink to="/more">
            <Ellipsis size={19} />
            More tools
          </NavLink>
          {profile?.role === "Admin" && (
            <>
              <div className="nav-caption">MANAGEMENT</div>
              {links([
                ["/marketing", "Marketing", Megaphone],
                ["/sync", "CISapp Sync", RefreshCw],
                ["/settings", "People & settings", Settings],
                ["/incentives", "Incentives", Wallet],
                ["/guide", "Admin guide", BookOpen],
              ])}
            </>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar small-avatar">
            {profile!.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <b>{profile!.name}</b>
            <span>{profile!.role} workspace</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />{" "}
            <strong>
              {location.pathname === "/"
                ? profile?.role === "Admin"
                  ? "Overview"
                  : "Today"
                : location.pathname.split("/").filter(Boolean)[0]}
            </strong>
          </div>
          <div className="topbar-right">
            {emulator && (
              <span className="demo-label">LOCAL TEST WORKSPACE</span>
            )}
            <span className="workspace-status">
              <i />
              Your next best action
            </span>
            <div className="avatar mini-avatar">
              {profile!.name.slice(0, 1)}
            </div>
            <button className="topbar-signout" onClick={logout}>
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        <main>
          {profile?.role === "Admin" && location.pathname !== "/sync" && <AutoCisappSync />}
          <AutoVisits />
          <AutoCollections />
          <Outlet />
        </main>
        <footer className="app-footer">
          Salesapp · Build relationships. Follow through.
        </footer>
      </div>
      <nav className="bottom-nav">
        {links([...mainLinks, ["/more", "More", Ellipsis]])}
      </nav>
    </div>
  );
}
function More() {
  const { profile } = useAuth();
  const extra = [
    ["/work/activities", "Activity history", Activity],
    ["/work/collectionPromises", "Payment promises", Wallet],
    ["/work/reactivations", "Reactivation", Users],
    ["/work/objections", "Lost sales & objections", MessageSquare],
    ["/work/competitorNotes", "Competitor notes", MessageSquare],
    ["/work/complaints", "Service recovery", LifeBuoy],
  ] as const;
  return (
    <>
      <h1>More tools</h1>
      <p className="subtle">Everything you need to keep work moving.</p>
      <div className="more-grid">
        {[
          ...(profile?.role === "Staff" ? workLinks.filter(([to]) => to !== "/collections" && to !== "/work/followUps") : workLinks),
          ...extra,
          ...(profile?.role === "Admin"
            ? [
                ["/marketing", "Marketing", Megaphone],
                ["/sync", "CISapp Sync", RefreshCw],
                ["/settings", "People & settings", Settings],
                ["/incentives", "Incentives", Wallet],
                ["/guide", "Admin guide", BookOpen],
              ]
            : []),
        ].map(([to, title, Icon]: any) => (
          <Link className="more-card" to={to} key={to}>
            <Icon size={22} />
            <b>{title}</b>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
    </>
  );
}
function Login() {
  const { login, error: authError, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <section className="login-story">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <ArrowUpRight size={25} />
          </span>
          Salesapp
        </Link>
        <div className="story-content">
          <div className="eyebrow">RELATIONSHIPS. ACTION. GROWTH.</div>
          <h1>
            Your next
            <br />
            best action
            <br />
            <em>starts here.</em>
          </h1>
          <p>
            A focused workspace for your people, your customers, and the
            conversations that move business forward.
          </p>
          <div className="story-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="visual-card visual-one">
              <span className="visual-icon">
                <Phone size={20} />
              </span>
              <div>
                <b>Make the connection</b>
                <small>Every conversation counts</small>
              </div>
              <span className="visual-tick">✓</span>
            </div>
            <div className="visual-card visual-two">
              <span className="visual-icon pink">
                <Target size={20} />
              </span>
              <div>
                <b>Follow through</b>
                <small>Turn intent into progress</small>
              </div>
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
        <small>Built for meaningful work. Designed for your team.</small>
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <div className="eyebrow">WELCOME TO YOUR WORKSPACE</div>
          <h2>Let’s get to work.</h2>
          <p>Sign in to see what needs your attention.</p>
          {emulator && (
            <div className="notice">
              Local test workspace · isolated from production
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await login(email, password);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ErrorBox message={error || authError} />
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p className="login-help">
            Need access? Your Admin can create your Salesapp account.
          </p>
          {authError && (
            <button className="text-button" onClick={logout}>
              Clear this session
            </button>
          )}
          <div className="login-security">
            <span className="status-dot" />A separate, secure workspace for
            sales execution.
          </div>
        </div>
      </section>
    </div>
  );
}
