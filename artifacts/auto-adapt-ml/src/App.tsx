import { type ChangeEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  Gauge,
  GitCompareArrows,
  History,
  LayoutDashboard,
  LineChart,
  Loader2,
  LogOut,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetActivityQueryKey,
  getGetDashboardQueryKey,
  getGetCurrentUserQueryKey,
  getGetDatasetsQueryKey,
  getGetModelsQueryKey,
  getGetMonitoringQueryKey,
  getGetRetrainingJobsQueryKey,
  useDeployModel,
  useCreatePrediction,
  useGetCurrentUser,
  useGetDatasets,
  useGetActivity,
  useGetDashboard,
  useGetModels,
  useGetMonitoring,
  useGetRetrainingJobs,
  useLogin,
  useLogout,
  useRollbackModel,
  useRunDriftCheck,
  useSignup,
  useTrainModel,
  useTriggerRetraining,
  useUpdateProfile,
  type ActivityItem,
  type DatasetSummary,
  type DriftCheckResult,
  type User,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/models', label: 'Model registry', icon: GitCompareArrows },
  { href: '/monitoring', label: 'Monitoring', icon: Gauge },
  { href: '/retraining', label: 'Retraining', icon: RefreshCw },
  { href: '/predictions', label: 'Predictions', icon: Target },
];

const utilityItems = [
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function statusTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('healthy') || normalized.includes('deployed') || normalized.includes('completed') || normalized.includes('success')) return 'success';
  if (normalized.includes('watch') || normalized.includes('candidate') || normalized.includes('running') || normalized.includes('medium')) return 'warning';
  if (normalized.includes('action') || normalized.includes('failed') || normalized.includes('high') || normalized.includes('rejected')) return 'danger';
  return 'neutral';
}

function StatusPill({ value }: { value: string }) {
  const tone = statusTone(value);
  return <span data-testid={`status-${value.toLowerCase().replace(/\s+/g, '-')}`} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.02em]', tone === 'success' && 'bg-[#e5f1c6] text-[#456013]', tone === 'warning' && 'bg-[#f7e8bf] text-[#855d18]', tone === 'danger' && 'bg-[#f5d7d1] text-[#943d32]', tone === 'neutral' && 'bg-[#e5e4db] text-[#5c625b]')}><span className={cn('h-1.5 w-1.5 rounded-full', tone === 'success' && 'bg-[#78a52a]', tone === 'warning' && 'bg-[#cf941f]', tone === 'danger' && 'bg-[#c95e4d]', tone === 'neutral' && 'bg-[#818981]')} />{value}</span>;
}

function Button({ children, variant = 'primary', className, disabled, onClick, testId, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; disabled?: boolean; onClick?: () => void; testId?: string; type?: 'button' | 'submit' }) {
  return <button type={type} data-testid={testId} disabled={disabled} onClick={onClick} className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[#b9d967] text-[#182d31] hover:bg-[#cbe887] active:scale-[.98]', variant === 'secondary' && 'border border-[#cad0c1] bg-[#f7f6ee] text-[#294248] hover:border-[#9ea98c] hover:bg-[#eeefe2]', variant === 'ghost' && 'text-[#526160] hover:bg-[#e8e9df] hover:text-[#1d373c]', variant === 'danger' && 'border border-[#e6b9b0] bg-[#fbede9] text-[#9b463a] hover:bg-[#f7ded8]', className)}>{children}</button>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div className="fade-up">
      <div className="eyebrow mb-2 text-[#668034]">{kicker}</div>
      <h1 className="text-3xl font-extrabold tracking-[-0.045em] text-[#1d373c] md:text-[2.45rem]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69736c]">{description}</p>
    </div>
    {action && <div className="fade-up-delay shrink-0">{action}</div>}
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon, accent = 'lime' }: { label: string; value: string; detail: string; icon: typeof Database; accent?: 'lime' | 'orange' | 'red' | 'teal' }) {
  const accentClass = { lime: 'bg-[#e8f2c9] text-[#59731e]', orange: 'bg-[#f8e9c4] text-[#8a641e]', red: 'bg-[#f7ddd6] text-[#96463a]', teal: 'bg-[#dcebed] text-[#336873]' }[accent];
  return <div data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`} className="lift rounded-xl border border-[#dcded2] bg-[#f8f8f1] p-4">
    <div className="flex items-start justify-between"><span className="eyebrow text-[#778079]">{label}</span><span className={cn('rounded-lg p-2', accentClass)}><Icon size={16} strokeWidth={2.2} /></span></div>
    <div className="mt-4 flex items-end justify-between gap-2"><span className="mono text-3xl font-medium tracking-[-0.08em] text-[#1d373c]">{value}</span><span className="mb-1 text-right text-[11px] leading-4 text-[#7a847d]">{detail}</span></div>
  </div>;
}

function Sparkline({ values, color = '#6d942a', fill = false }: { values: number[]; color?: string; fill?: boolean }) {
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - value * 86}`).join(' ');
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
    {fill && <polygon points={`0,100 ${points} 100,100`} fill={color} opacity=".1" />}
    <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    {values.map((value, index) => <circle key={`${value}-${index}`} cx={(index / Math.max(values.length - 1, 1)) * 100} cy={100 - value * 86} r="1.9" fill="#f8f8f1" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
  </svg>;
}

function SectionCard({ children, className = '', title, eyebrow, action }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; action?: ReactNode }) {
  return <section className={cn('rounded-xl border border-[#dcded2] bg-[#f8f8f1]', className)}>
    {(title || eyebrow) && <div className="flex items-start justify-between border-b border-[#e3e4da] px-5 py-4"><div><div className="eyebrow text-[#778079]">{eyebrow}</div><h2 className="mt-1 text-[15px] font-extrabold tracking-[-0.02em] text-[#294248]">{title}</h2></div>{action}</div>}
    {children}
  </section>;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = item.type === 'deploy' ? Rocket : item.type === 'drift' ? LineChart : item.type === 'retrain' ? RefreshCw : Database;
  const tone = statusTone(item.tone);
  return <div data-testid={`activity-row-${item.id}`} className="group flex gap-3 border-b border-[#e6e6dc] py-3.5 last:border-0">
    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone === 'success' && 'bg-[#e8f2c9] text-[#668d25]', tone === 'warning' && 'bg-[#f7e9c4] text-[#966a21]', tone === 'danger' && 'bg-[#f7ddd6] text-[#a1463b]', tone === 'neutral' && 'bg-[#e6e9e0] text-[#64716b]')}><Icon size={15} /></div>
    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-bold text-[#294248]">{item.title}</p><span className="mono shrink-0 text-[10px] text-[#8a938b]">{item.time}</span></div><p className="mt-1 truncate text-xs text-[#78827b]">{item.detail}</p></div>
  </div>;
}

function LoadingPanel({ label = 'Loading signal' }: { label?: string }) {
  return <div className="rounded-xl border border-[#dcded2] bg-[#f8f8f1] p-6"><div className="space-y-3"><div className="h-3 w-24 animate-pulse rounded bg-[#e5e6dc]" /><div className="h-8 w-48 animate-pulse rounded bg-[#e5e6dc]" /><div className="h-3 w-full animate-pulse rounded bg-[#e9e9e0]" /><div className="h-3 w-4/5 animate-pulse rounded bg-[#e9e9e0]" /></div><p className="mt-5 text-xs text-[#879087]">{label}…</p></div>;
}

function ErrorBanner({ onRetry, detail = 'Live telemetry is unavailable right now.' }: { onRetry: () => void; detail?: string }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e7c2b9] bg-[#fff1ec] px-4 py-3 text-sm text-[#88473e]"><span className="flex items-center gap-2"><AlertTriangle size={16} />{detail}</span><Button variant="danger" onClick={onRetry} testId="button-retry"><RefreshCw size={14} />Retry connection</Button></div>;
}

function AppShell({ children, user }: { children: ReactNode; user: User }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  const qc = useQueryClient();
  const current = [...navItems, ...utilityItems].find((item) => item.href === location);
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => {
    qc.clear();
  } });
  return <div className="min-h-[100dvh] bg-[#f1f0e8] text-[#1d373c]">
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col bg-[#192f34] px-4 py-5 text-[#eef0dd] transition-transform duration-300 lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-3" data-testid="link-brand"><span className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#b9d967] text-[#192f34]"><span className="absolute h-3.5 w-3.5 rounded-full border-[2px] border-[#192f34]" /><span className="absolute h-1.5 w-1.5 rounded-full bg-[#192f34]" /></span><span><span className="block text-[14px] font-extrabold tracking-[-0.02em]">auto adapt</span><span className="eyebrow block text-[9px] text-[#aab89e]">ml command center</span></span></Link>
        <button className="rounded-md p-1 text-[#aab89e] hover:bg-[#294248] lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={18} /></button>
      </div>
      <div className="mt-9 px-2"><div className="eyebrow text-[#7e978f]">Workspace</div><div className="mt-2 flex items-center gap-2 rounded-lg border border-[#345158] bg-[#223c42] px-3 py-2"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#d4e89e] text-[10px] font-extrabold text-[#294248]">{user.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-xs font-bold">{user.full_name}&apos;s workspace</span><ChevronRight size={13} className="text-[#7e978f]" /></div></div>
      <nav className="mt-8 flex-1 space-y-1" aria-label="Primary navigation">
        <div className="eyebrow mb-2 px-3 text-[#7e978f]">Operate</div>
        {navItems.map((item) => <NavItem key={item.href} {...item} active={location === item.href} onNavigate={() => setMobileOpen(false)} />)}
        <div className="eyebrow mb-2 mt-7 px-3 text-[#7e978f]">Workspace</div>
        {utilityItems.map((item) => <NavItem key={item.href} {...item} active={location === item.href} onNavigate={() => setMobileOpen(false)} />)}
      </nav>
      <div className="rounded-xl border border-[#345158] bg-[#203a40] p-3.5"><div className="flex items-center gap-2"><Database size={14} className="text-[#b9d967]" /><span className="eyebrow text-[#b9d967]">Private workspace</span></div><p className="mt-2 text-xs leading-5 text-[#aab89e]">Your datasets, model artifacts, and activity are stored in the local workspace database.</p></div>
       <div className="mt-4 flex items-center gap-3 border-t border-[#345158] px-2 pt-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9e3bc] text-xs font-extrabold text-[#294248]">{user.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user.full_name}</p><p className="truncate text-[10px] text-[#8da29b]">{user.email}</p></div><button onClick={handleLogout} disabled={logout.isPending} className="rounded-md p-1.5 text-[#8da29b] hover:bg-[#294248] hover:text-[#eef0dd]" aria-label="Sign out" data-testid="button-logout"><LogOut size={16} /></button></div>
    </aside>
    <div className="lg:pl-[246px]">
      <header className="sticky top-0 z-30 flex h-[69px] items-center justify-between border-b border-[#dfe0d5] bg-[#f1f0e8]/95 px-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3"><button className="rounded-lg border border-[#d5d8cb] bg-[#f8f8f1] p-2 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={18} /></button><div className="hidden h-8 w-px bg-[#d8dad0] lg:block" /><span className="text-sm font-bold text-[#52615f]">{current?.label ?? 'Command center'}</span></div>
        <div className="flex items-center gap-2 md:gap-4"><div className="hidden items-center gap-2 rounded-full border border-[#d9dbd0] bg-[#f8f8f1] px-3 py-1.5 text-xs text-[#77827b] md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#82a831]" />Local workspace</div><button className="rounded-lg p-2 text-[#64716b] hover:bg-[#e6e7de]" data-testid="button-notifications"><Bell size={17} /></button><Link href="/settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9e3bc] text-xs font-extrabold text-[#294248]" data-testid="link-account">{user.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Link></div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9">{children}</main>
    </div>
  </div>;
}

function NavItem({ href, label, icon: Icon, active, onNavigate }: { href: string; label: string; icon: typeof Database; active: boolean; onNavigate: () => void }) {
  return <Link href={href} onClick={onNavigate} data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors', active ? 'bg-[#b9d967] font-extrabold text-[#192f34]' : 'text-[#adbbb0] hover:bg-[#29464b] hover:text-[#eef0dd]')}><Icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#57701e]" />}</Link>;
}

function DashboardPage() {
  const dashboardQuery = useGetDashboard();
  const activityQuery = useGetActivity();
  const dashboard = dashboardQuery.data;
  const activity = activityQuery.data ?? [];
  const performanceValues = dashboard?.performance.map((point) => point.accuracy) ?? [];
  const driftValues = dashboard?.driftTrend.map((point) => point.score / 0.6) ?? [];
  if (dashboardQuery.isLoading) return <><PageHeader kicker="System overview" title="Model health, at a glance." description="Your production loop from detect to deploy, in one calm operating view." /><LoadingPanel label="Connecting to production telemetry" /></>;
  return <div className="fade-up">
    <PageHeader kicker="System overview / Today" title="Model health, at a glance." description="Your production loop from detect to deploy, in one calm operating view." action={<Link href="/monitoring" data-testid="link-dashboard-monitoring"><Button><Play size={15} fill="currentColor" />Run drift check</Button></Link>} />
    {dashboardQuery.isError && <ErrorBanner onRetry={() => void dashboardQuery.refetch()} />}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Datasets" value={String(dashboard?.datasetCount ?? 0)} detail="saved CSV uploads" icon={Database} accent="teal" />
      <MetricCard label="Registered models" value={String(dashboard?.modelCount ?? 0)} detail="trained versions" icon={GitCompareArrows} accent="lime" />
      <MetricCard label="Drift events" value={String(dashboard?.driftEvents ?? 0)} detail="persisted comparisons" icon={LineChart} accent="orange" />
      <MetricCard label="Retraining jobs" value={String(dashboard?.retrainingJobs ?? 0)} detail="saved recovery jobs" icon={RefreshCw} accent="red" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
       <SectionCard title="Production performance" eyebrow="Compare" action={<Link href="/models" className="text-xs font-bold text-[#6b8f29] hover:text-[#456013]" data-testid="link-dashboard-models">View registry <ArrowRight size={13} className="ml-1 inline" /></Link>}>
         <div className="p-5">{dashboard?.deployedModel ? <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mono text-4xl tracking-[-0.08em] text-[#1d373c]">{dashboard.deployedModel.taskType === 'regression' ? Number(dashboard.deployedModel.metrics?.r2 ?? dashboard.deployedModel.accuracy).toFixed(3) : formatPercent(dashboard.deployedModel.accuracy)}</div><div className="mt-1 flex items-center gap-2 text-xs text-[#728079]"><span className="inline-flex items-center gap-1 text-[#668d25]"><span className="h-1.5 w-1.5 rounded-full bg-[#82a831]" />{dashboard.deployedModel.taskType === 'regression' ? 'R² on holdout data' : 'Measured on holdout data'}</span><span>·</span><span>Active: {dashboard.deployedModel.name}</span></div></div><div className="flex gap-5 text-xs"><span className="flex items-center gap-2 text-[#66736d]"><span className="h-2 w-2 rounded-full bg-[#668e30]" />Primary metric</span></div></div><div className="relative h-48 w-full"><div className="absolute inset-0 flex flex-col justify-between text-[10px] text-[#a0a69d]"><span>100%</span><span>90%</span><span>80%</span></div><div className="ml-9 h-full border-b border-l border-[#e1e2d8] pl-2 pb-2"><Sparkline values={performanceValues.map((v) => (v - .8) * 5)} color="#668e30" fill /><div className="pointer-events-none absolute inset-x-0 bottom-0 ml-11 flex justify-between text-[10px] text-[#9aa29b]">{dashboard.performance.map((point) => <span key={point.label}>{point.label}</span>)}</div></div></div></> : <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfd5c9] bg-[#f2f3ea] text-center"><GitCompareArrows size={26} className="text-[#93a08e]" /><p className="mt-3 text-sm font-bold text-[#5d6c63]">No deployed model yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#89938b]">Upload a labelled CSV, train a candidate, then deploy it to populate production metrics.</p></div>}</div>
      </SectionCard>
      <SectionCard title="Drift pressure" eyebrow="Detect" action={<StatusPill value={dashboard?.driftTrend.at(-1)?.severity ?? 'Not configured'} />}>
        <div className="p-5"><div className="flex items-end justify-between"><div><div className="mono text-4xl tracking-[-0.08em] text-[#1d373c]">{dashboard?.driftTrend.at(-1)?.score.toFixed(2) ?? '—'}</div><p className="mt-1 text-xs text-[#77827b]">Measured feature distribution shift</p></div></div><div className="mt-8 h-32 border-b border-[#e1e2d8]"><Sparkline values={driftValues} color="#d79a37" fill /></div><div className="mt-3 flex justify-between text-[10px] text-[#9aa29b]">{dashboard?.driftTrend.map((point) => <span key={point.label}>{point.label}</span>)}</div></div>
      </SectionCard>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
       <SectionCard title="Active production model" eyebrow="Deploy" action={<Link href="/models" className="rounded-md p-1.5 text-[#7a867d] hover:bg-[#e8e9df]" data-testid="link-active-model"><ChevronRight size={17} /></Link>}>
         <div className="p-5">{dashboard?.deployedModel ? <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="text-xl font-extrabold tracking-[-0.035em] text-[#294248]">{dashboard.deployedModel.name}</h3><StatusPill value="Deployed" /></div><p className="mt-1 text-xs text-[#7a847d]">{dashboard.deployedModel.algorithm} · {dashboard.deployedModel.dataset}</p></div><div className="mono text-xs text-[#7a847d]">{dashboard.deployedModel.version}</div><div className="mt-6 grid w-full grid-cols-3 gap-3"><div className="rounded-lg bg-[#eeefe6] p-3"><div className="eyebrow text-[#838d84]">{dashboard.deployedModel.taskType === 'regression' ? 'R²' : 'Accuracy'}</div><div className="mono mt-2 text-lg text-[#294248]">{dashboard.deployedModel.taskType === 'regression' ? Number(dashboard.deployedModel.metrics?.r2 ?? dashboard.deployedModel.accuracy).toFixed(3) : formatPercent(dashboard.deployedModel.accuracy)}</div></div><div className="rounded-lg bg-[#eeefe6] p-3"><div className="eyebrow text-[#838d84]">{dashboard.deployedModel.taskType === 'regression' ? 'RMSE' : 'F1 score'}</div><div className="mono mt-2 text-lg text-[#294248]">{dashboard.deployedModel.taskType === 'regression' ? Number(dashboard.deployedModel.metrics?.rmse ?? 0).toFixed(3) : formatPercent(dashboard.deployedModel.f1)}</div></div><div className="rounded-lg bg-[#eeefe6] p-3"><div className="eyebrow text-[#838d84]">Features</div><div className="mono mt-2 text-lg text-[#294248]">{dashboard.deployedModel.features}</div></div></div><div className="mt-5 flex w-full items-center justify-between border-t border-[#e6e6dc] pt-4 text-xs text-[#7a847d]"><span>Last updated {dashboard.deployedModel.lastUpdated}</span><span className="inline-flex items-center gap-1.5 text-[#668d25]"><span className="h-1.5 w-1.5 rounded-full bg-[#82a831]" />Deployed artifact active</span></div></div> : <div className="py-10 text-center"><p className="text-sm font-bold text-[#53635e]">Deployment starts after evaluation.</p><p className="mt-1 text-xs text-[#849087]">Your first trained model will appear here once it is deployed.</p></div>}</div>
      </SectionCard>
      <SectionCard title="Recent activity" eyebrow="Observe" action={<Link href="/activity" className="text-xs font-bold text-[#6b8f29] hover:text-[#456013]" data-testid="link-dashboard-activity">See all <ArrowRight size={13} className="ml-1 inline" /></Link>}>
        <div className="px-5">{activityQuery.isLoading ? <LoadingPanel label="Loading activity" /> : activity.slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)}</div>
      </SectionCard>
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#d5dcb9] bg-[#eaf1d4] px-5 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d5e79c] text-[#59731e]"><ShieldCheck size={17} /></div><div className="flex-1"><p className="text-sm font-extrabold text-[#3e5b25]">The loop is clear.</p><p className="mt-0.5 text-xs text-[#687c50]">Detect drift, inspect the cause, retrain a candidate, compare against production, then deploy with confidence.</p></div><Link href="/retraining" data-testid="link-dashboard-retraining"><Button variant="secondary">Open retraining queue <ArrowRight size={14} /></Button></Link></div>
  </div>;
}

function ModelsPage() {
  const query = useGetModels();
  const deploy = useDeployModel();
  const rollback = useRollbackModel();
  const qc = useQueryClient();
  const models = query.data ?? [];
  const [filter, setFilter] = useState('All');
  const filtered = filter === 'All' ? models : models.filter((model) => model.status === filter);
  const runMutation = (kind: 'deploy' | 'rollback', id: string) => {
    const mutation = kind === 'deploy' ? deploy : rollback;
    mutation.mutate({ modelId: id }, { onSuccess: () => {
      void qc.invalidateQueries({ queryKey: getGetModelsQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
    } });
  };
  return <div className="fade-up"><PageHeader kicker="Model registry / Compare" title="Versions with a paper trail." description="See what is serving, what is ready, and what should never reach production." action={<Link href="/retraining" data-testid="link-models-retrain"><Button><Plus size={15} />Start retraining</Button></Link>} />{query.isError && <ErrorBanner onRetry={() => void query.refetch()} />}{(deploy.isError || rollback.isError) && <ErrorBanner detail={(deploy.error ?? rollback.error) instanceof Error ? String((deploy.error ?? rollback.error)?.message ?? 'Model action failed.') : 'Model action failed.'} onRetry={() => { deploy.reset(); rollback.reset(); }} />}{query.isLoading ? <LoadingPanel label="Loading model registry" /> : <SectionCard><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e4da] px-5 py-4"><div className="flex gap-1 rounded-lg bg-[#edeee5] p-1">{['All', 'Deployed', 'Candidate', 'Evaluated', 'Rolled Back'].map((item) => <button key={item} onClick={() => setFilter(item)} data-testid={`button-filter-${item.toLowerCase().replace(/\s+/g, '-')}`} className={cn('rounded-md px-3 py-1.5 text-xs font-bold transition-colors', filter === item ? 'bg-[#f8f8f1] text-[#294248] shadow-sm' : 'text-[#818a82] hover:text-[#294248]')}>{item}</button>)}</div><div className="flex items-center gap-2 text-xs text-[#77827b]"><Search size={14} />{filtered.length} versions</div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#e5e5dc] text-[10px] uppercase tracking-[.12em] text-[#8b948c]"><th className="px-5 py-3 font-medium">Model / version</th><th className="px-3 py-3 font-medium">Dataset</th><th className="px-3 py-3 font-medium">Quality</th><th className="px-3 py-3 font-medium">Updated</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{filtered.map((model) => {
  const hasDeployedSibling = models.some((item) => item.name === model.name && item.status === 'Deployed');
  const isRegression = model.taskType === 'regression';
  const rmse = Number(model.metrics?.rmse ?? 0);
  return <tr key={model.id} data-testid={`row-model-${model.id}`} className="group border-b border-[#e8e8df] last:border-0 hover:bg-[#f2f3e9]"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e4edc7] text-[#59731e]"><GitCompareArrows size={16} /></div><div><div className="flex items-center gap-2"><span className="text-sm font-extrabold text-[#294248]">{model.name}</span><span className="mono text-[10px] text-[#89928b]">{model.version}</span><StatusPill value={model.status} /></div><p className="mt-1 text-xs text-[#7c877e]">{model.algorithm} · {model.features} features</p></div></div></td><td className="px-3 py-4"><span className="mono text-xs text-[#55655f]">{model.dataset}</span></td><td className="px-3 py-4"><div className="flex flex-col gap-1"><span className="text-xs font-bold text-[#294248]">{isRegression ? `R² ${Number(model.metrics?.r2 ?? model.accuracy).toFixed(3)}` : `Accuracy ${formatPercent(model.accuracy)}`}</span><span className="text-xs text-[#77827b]">{isRegression ? `RMSE ${rmse.toFixed(3)}` : `F1 ${formatPercent(model.f1)}`}</span></div></td><td className="px-3 py-4 text-xs text-[#77827b]">{model.lastUpdated}</td><td className="px-5 py-4 text-right">{model.status === 'Deployed' ? <span className="text-xs font-bold text-[#668d25]">Active version</span> : hasDeployedSibling ? <Button variant="danger" onClick={() => runMutation('rollback', model.id)} disabled={rollback.isPending} testId={`button-rollback-${model.id}`}><RotateCcw size={14} />Restore version</Button> : <Button variant="secondary" onClick={() => runMutation('deploy', model.id)} disabled={deploy.isPending} testId={`button-deploy-${model.id}`}><Rocket size={14} />Deploy</Button>}</td></tr>;
})}</tbody></table>{filtered.length === 0 && <div className="p-12 text-center"><GitCompareArrows className="mx-auto text-[#96a08d]" /><p className="mt-3 text-sm font-bold text-[#53635e]">No trained versions yet.</p><p className="mt-1 text-xs text-[#849087]">Upload a labelled dataset to train the first candidate.</p></div>}</div></SectionCard>}</div>;
}

function MonitoringPage() {
  const query = useGetMonitoring();
  const check = useRunDriftCheck();
  const [result, setResult] = useState<DriftCheckResult | null>(null);
  const monitoring = query.data;
  const qc = useQueryClient();
  const handleCheck = () => check.mutate(undefined, { onSuccess: (data) => {
    setResult(data);
    void qc.invalidateQueries({ queryKey: getGetMonitoringQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
  } });
  const features = result?.features ?? [];
  return <div className="fade-up"><PageHeader kicker="Monitoring / Detect" title="Know before users do." description="Compare an incoming batch with a reference dataset using measured statistical tests." action={<Button onClick={handleCheck} disabled={check.isPending} testId="button-run-drift-check">{check.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />} {check.isPending ? 'Checking signals…' : 'Run drift check'}</Button>} />{query.isError && <ErrorBanner onRetry={() => void query.refetch()} />}{check.isError && <ErrorBanner detail="The drift check could not run. Upload two comparable CSV datasets first." onRetry={() => void check.reset()} />}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Monitor mode" value={monitoring?.mode ?? '—'} detail="reference / incoming" icon={Zap} accent="teal" /><MetricCard label="Drift score" value={monitoring ? monitoring.driftScore.toFixed(2) : '—'} detail="threshold 0.35" icon={LineChart} accent={monitoring && monitoring.driftScore > .35 ? 'orange' : 'lime'} /><MetricCard label="Label coverage" value={monitoring ? formatPercent(monitoring.labelCoverage) : '—'} detail="observed in latest check" icon={Target} accent="lime" /><MetricCard label="Last checked" value={monitoring?.lastChecked ?? '—'} detail="measured event" icon={Clock3} accent="teal" /></div><div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><SectionCard title="Monitoring posture" eyebrow="Current state"><div className="p-5"><div className="flex items-center gap-3 rounded-xl border border-[#d6e4b2] bg-[#edf4d9] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d5e8a1] text-[#58741d]"><CheckCircle2 size={20} /></div><div><p className="text-sm font-extrabold text-[#466127]">{monitoring?.status ?? 'Not configured'}</p><p className="mt-1 text-xs leading-5 text-[#6c7e53]">{monitoring ? 'The latest statistical comparison is stored in the audit history.' : 'Upload two datasets to establish a measured comparison.'}</p></div></div><div className="mt-6 space-y-5"><div><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-[#53635e]">Label coverage</span><span className="mono text-[#6f7d73]">{monitoring ? formatPercent(monitoring.labelCoverage) : '—'}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e4e7dc]"><div className="h-full rounded-full bg-[#789b35]" style={{ width: `${(monitoring?.labelCoverage ?? 0) * 100}%` }} /></div></div><div><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-[#53635e]">Drift budget used</span><span className="mono text-[#6f7d73]">{monitoring ? `${Math.round(monitoring.driftScore / .35 * 100)}%` : '—'}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e4e7dc]"><div className="h-full rounded-full bg-[#d49a36]" style={{ width: `${Math.min((monitoring?.driftScore ?? 0) / .35 * 100, 100)}%` }} /></div></div></div></div></SectionCard><SectionCard title="Feature watchlist" eyebrow={result ? 'Latest drift check' : 'Run a measured check'} action={<Button variant="ghost" className="px-2" onClick={handleCheck} disabled={check.isPending} testId="button-refresh-features"><RefreshCw size={15} /></Button>}><div className="divide-y divide-[#e6e6dc] px-5">{result && <div className="my-4 rounded-lg bg-[#f0f2e7] p-3 text-xs text-[#5e6d62]"><strong className="text-[#294248]">{result.summary}</strong><span className="ml-2 mono">score {result.score.toFixed(2)}</span></div>}{features.length > 0 ? features.map((feature) => <div key={feature.name} className="flex items-center gap-3 py-3.5"><div className={cn('h-2 w-2 rounded-full', statusTone(feature.status) === 'success' ? 'bg-[#82a831]' : statusTone(feature.status) === 'warning' ? 'bg-[#d49a36]' : 'bg-[#98a099]')} /><span className="flex-1 text-sm font-bold text-[#53635e]">{feature.name}</span><div className="w-28"><div className="h-1.5 rounded-full bg-[#e5e6dc]"><div className={cn('h-full rounded-full', statusTone(feature.status) === 'warning' ? 'bg-[#d49a36]' : 'bg-[#8ba44a]')} style={{ width: `${feature.score * 100}%` }} /></div></div><span className="mono w-10 text-right text-xs text-[#738078]">{feature.score.toFixed(2)}</span><StatusPill value={feature.status} /></div>) : <div className="py-12 text-center text-xs text-[#849087]">No drift comparison has been run yet.</div>}</div></SectionCard></div><div className="mt-5 rounded-xl border border-[#d8d8ca] bg-[#e8e8dc] px-5 py-4"><div className="flex items-start gap-3"><CircleHelp size={17} className="mt-0.5 text-[#69766f]" /><p className="text-xs leading-5 text-[#69766f]"><strong className="text-[#43534e]">How to read this:</strong> numerical features use a Kolmogorov–Smirnov test and categorical features use a chi-square comparison. Feature drift does not by itself confirm concept drift.</p></div></div></div>;
}

function RetrainingPage() {
  const query = useGetRetrainingJobs();
  const trigger = useTriggerRetraining();
  const qc = useQueryClient();
  const jobs = query.data ?? [];
  const start = () => trigger.mutate(undefined, { onSuccess: () => {
    void qc.invalidateQueries({ queryKey: getGetRetrainingJobsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
  } });
  return <div className="fade-up"><PageHeader kicker="Retraining / Recover" title="Turn signal into a candidate." description="Retrain on labelled data, compare against the active artifact, and deploy only when the acceptance gate passes." action={<Button onClick={start} disabled={trigger.isPending} testId="button-trigger-retraining">{trigger.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {trigger.isPending ? 'Starting…' : 'Trigger retraining'}</Button>} />{query.isError && <ErrorBanner onRetry={() => void query.refetch()} />}{trigger.isError && <ErrorBanner detail={trigger.error instanceof Error ? trigger.error.message : 'Retraining failed.'} onRetry={() => trigger.reset()} />}<div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><SectionCard title="Training queue" eyebrow="Jobs"><div className="divide-y divide-[#e6e6dc] px-5">{query.isLoading ? <LoadingPanel label="Loading retraining jobs" /> : jobs.map((job) => <div key={job.id} data-testid={`row-job-${job.id}`} className="flex flex-wrap items-center gap-4 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e5edcb] text-[#638326]"><RefreshCw size={17} className={job.status === 'Running' ? 'animate-spin' : ''} /></div><div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-extrabold text-[#294248]">{job.model}</span><span className="mono text-[10px] text-[#89928b]">{job.id}</span><StatusPill value={job.status} /></div><p className="mt-1 text-xs text-[#7b867d]">{job.trigger} · {job.startedAt}</p></div><div className="w-full sm:w-44"><div className="mb-1.5 flex justify-between text-[10px] text-[#849087]"><span>Progress</span><span className="mono">{job.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e3e5db]"><div className={cn('h-full rounded-full', job.status === 'Failed' ? 'bg-[#c95e4d]' : 'bg-[#82a831]')} style={{ width: `${job.progress}%` }} /></div></div></div>)}</div>{jobs.length === 0 && <div className="p-12 text-center"><RefreshCw className="mx-auto text-[#96a08d]" /><p className="mt-3 text-sm font-bold text-[#53635e]">No retraining jobs yet.</p><p className="mt-1 text-xs text-[#849087]">Deploy a model before starting a recovery run.</p></div>}</SectionCard><div className="space-y-5"><SectionCard title="Candidate gate" eyebrow="Compare"><div className="p-5"><p className="text-xs leading-5 text-[#758178]">The backend evaluates the candidate on a holdout split and keeps the active artifact when the configured improvement threshold is not met.</p></div></SectionCard><SectionCard title="Recovery recipe" eyebrow="Loop"><div className="space-y-3 p-5">{['Detect drift in production', 'Explain the feature shift', 'Retrain on fresh labels', 'Compare candidate vs active', 'Deploy or keep serving'].map((step, index) => <div key={step} className="flex items-center gap-3"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold', index < 2 ? 'bg-[#dceabd] text-[#5f7c28]' : 'bg-[#e6e7df] text-[#79857b]')}>{index + 1}</span><span className={cn('text-xs font-bold', index < 2 ? 'text-[#42584a]' : 'text-[#78847b]')}>{step}</span>{index < 2 && <Check size={14} className="ml-auto text-[#73952f]" />}</div>)}</div></SectionCard></div></div></div>;
}

function PredictionsPage() {
  const [text, setText] = useState('');
  const [output, setOutput] = useState<{ prediction: unknown; confidence?: number | null; version?: string } | null>(null);
  const modelsQuery = useGetModels();
  const run = useCreatePrediction();
  const active = modelsQuery.data?.find((model) => model.status === 'Deployed');
  const submit = () => {
    if (!active) return;
    const features = Object.fromEntries(text.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      const value = rest.join('=').trim();
      const numeric = Number(value);
      return [key.trim(), value !== '' && Number.isFinite(numeric) ? numeric : value];
    }).filter(([key]) => key));
    run.mutate({ data: { model_id: active.id, features } }, { onSuccess: (data) => setOutput(data) });
  };
  return <div className="fade-up"><PageHeader kicker="Predictions / Verify" title="Ask the active model." description="Send a feature payload to the currently deployed, persisted artifact." action={<Link href="/models" data-testid="link-predictions-registry"><Button variant="secondary"><GitCompareArrows size={15} />View active model</Button></Link>} /><div className="grid gap-5 xl:grid-cols-[1fr_.85fr]"><SectionCard title="Prediction request" eyebrow="Active model"><div className="p-5"><div className="rounded-lg border border-[#d8ddd0] bg-[#eff1e8] px-3 py-2.5"><div className="flex items-center gap-2 text-xs text-[#6c7c70]"><span className="h-1.5 w-1.5 rounded-full bg-[#82a831]" />{active ? `${active.name} / ${active.version}` : 'No deployed model'}<span className="ml-auto mono text-[10px]">POST /predictions</span></div></div><label className="mt-5 block text-xs font-bold text-[#53635e]" htmlFor="prediction-payload">Feature payload</label><textarea id="prediction-payload" value={text} onChange={(event) => setText(event.target.value)} data-testid="input-prediction-payload" className="mt-2 min-h-40 w-full resize-y rounded-lg border border-[#ced4c6] bg-[#fbfaf3] p-4 font-mono text-sm leading-7 text-[#3e514e] outline-none transition-colors placeholder:text-[#9ba59c] focus:border-[#88a949] focus:ring-2 focus:ring-[#cfe19d]" /><div className="mt-3 flex items-center justify-between text-[11px] text-[#879188]"><span>Comma-separated key=value pairs</span><span className="mono">{text.length} chars</span></div><Button className="mt-5 w-full" onClick={submit} disabled={!text || !active || run.isPending} testId="button-run-prediction">{run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} fill="currentColor" />} {run.isPending ? 'Running…' : 'Run prediction'}</Button>{run.isError && <p className="mt-3 text-xs text-[#9b463a]">Prediction failed. Check that the payload keys match the trained features.</p>}</div></SectionCard><SectionCard title="Prediction result" eyebrow="Measured output"><div className="p-5">{!output ? <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfd5c9] bg-[#f2f3ea] text-center"><Target size={26} className="text-[#93a08e]" /><p className="mt-3 text-sm font-bold text-[#5d6c63]">Ready for a request</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#89938b]">Deploy a model and send a payload to see its actual prediction.</p></div> : <div className="fade-up"><div className="rounded-xl bg-[#e8f1ca] p-5"><div className="eyebrow text-[#66802d]">Prediction</div><div className="mt-2 break-all mono text-5xl tracking-[-.08em] text-[#37511f]">{String(output.prediction)}</div><div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#65802f]"><CheckCircle2 size={14} />Artifact version {output.version}</div>{output.confidence != null && <p className="mt-2 text-xs text-[#65802f]">Confidence {(output.confidence * 100).toFixed(1)}%</p>}</div></div>}</div></SectionCard></div></div>;
}

function ActivityPage() {
  const query = useGetActivity();
  const activity = query.data ?? [];
  return <div className="fade-up"><PageHeader kicker="Activity / Audit" title="A clear history of change." description="Every measured drift check, model decision, and deployment in one chronological trail." action={<Button variant="secondary" onClick={() => void query.refetch()} testId="button-refresh-activity"><RefreshCw size={15} />Refresh timeline</Button>} />{query.isError && <ErrorBanner onRetry={() => void query.refetch()} />}<SectionCard title="Audit timeline" eyebrow="All events"><div className="px-5">{query.isLoading ? <LoadingPanel label="Loading audit timeline" /> : activity.length > 0 ? activity.map((item, index) => <div key={item.id} data-testid={`timeline-item-${item.id}`} className="relative flex gap-4 py-5 first:pt-2">{index < activity.length - 1 && <div className="absolute bottom-0 left-[15px] top-11 w-px bg-[#dfe2d6]" />}<div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-[#f8f8f1]', statusTone(item.tone) === 'success' ? 'bg-[#cfe29a] text-[#52701e]' : statusTone(item.tone) === 'warning' ? 'bg-[#f1d58f] text-[#8e641f]' : 'bg-[#d7e5e5] text-[#3b737d]')}><span className="h-2 w-2 rounded-full bg-current" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-extrabold text-[#294248]">{item.title}</p><span className="mono text-[10px] text-[#8b958c]">{item.time}</span></div><p className="mt-1 text-xs leading-5 text-[#78847b]">{item.detail}</p><span className="mt-2 inline-block rounded bg-[#eef0e7] px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#768278]">{item.type}</span></div></div>) : <div className="p-12 text-center"><History className="mx-auto text-[#96a08d]" /><p className="mt-3 text-sm font-bold text-[#53635e]">No activity recorded yet.</p></div>}</div></SectionCard></div>;
}

function DatasetsPage() {
  const query = useGetDatasets();
  const qc = useQueryClient();
  const train = useTrainModel();
  const [selected, setSelected] = useState<DatasetSummary | null>(null);
  const [target, setTarget] = useState('');
  const [task, setTask] = useState<'classification' | 'regression'>('classification');
  const [algorithm, setAlgorithm] = useState('random_forest');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const datasets = query.data ?? [];
  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/datasets/upload', { method: 'POST', body: form, credentials: 'include' });
      const payload = await response.json().catch(() => ({} as { detail?: string; message?: string }));
      if (!response.ok) throw new Error(payload.detail ?? payload.message ?? `Upload failed (HTTP ${response.status}).`);
      setMessage('CSV uploaded and validated.');
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetDatasetsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetActivityQueryKey() }),
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const chooseDataset = (dataset: DatasetSummary) => {
    setSelected(dataset);
    setTarget(dataset.targetColumn ?? dataset.columns.at(-1) ?? '');
  };
  const submitTraining = () => {
    if (!selected || !target) return;
    train.mutate({ data: { dataset_id: selected.id, target_column: target, task_type: task, algorithm } }, {
      onSuccess: async () => {
        setMessage('Training completed. Review the new version in the model registry.');
        await Promise.all([
          qc.invalidateQueries({ queryKey: getGetModelsQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetActivityQueryKey() }),
          qc.invalidateQueries({ queryKey: getGetDatasetsQueryKey() }),
        ]);
      },
      onError: (error) => setMessage(error instanceof Error ? error.message : 'Training failed.'),
    });
  };
  return <div className="fade-up"><PageHeader kicker="Datasets / Foundations" title="The evidence models learn from." description="Upload real CSV inputs, inspect their schema, and choose the target before training." action={<label className={cn('inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b9d967] px-3.5 py-2.5 text-sm font-bold text-[#182d31] hover:bg-[#cbe887]', uploading && 'opacity-50')} data-testid="button-upload-dataset"><Upload size={15} />{uploading ? 'Validating…' : 'Upload CSV'}<input className="hidden" type="file" accept=".csv" onChange={onUpload} disabled={uploading} data-testid="input-upload-dataset" /></label>} />{message && <div className={cn("mb-5 rounded-lg border px-4 py-3 text-sm", /failed|error|http \d{3}|not found|requires/i.test(message) ? "border-[#e7c2b9] bg-[#fff1ec] text-[#88473e]" : "border-[#d5dcb9] bg-[#eaf1d4] text-[#527020]")}>{message}</div>}<div className="grid gap-5 xl:grid-cols-[1fr_.8fr]"><SectionCard title="Dataset inventory" eyebrow="Persisted inputs"><div className="divide-y divide-[#e6e6dc] px-5">{query.isLoading ? <LoadingPanel label="Loading datasets" /> : datasets.length > 0 ? datasets.map((dataset, index) => <button onClick={() => chooseDataset(dataset)} key={dataset.id} data-testid={`row-dataset-${index}`} className={cn('flex w-full flex-wrap items-center gap-4 py-4 text-left', selected?.id === dataset.id && 'rounded-lg bg-[#edf2df] px-3')}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#dcebed] text-[#3a727c]"><Database size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#294248]">{dataset.name}</p><p className="mt-1 text-xs text-[#7d887f]">{dataset.rowCount.toLocaleString()} rows · {dataset.featureCount} features</p></div><StatusPill value={dataset.targetColumn ? 'Ready' : 'Uploaded'} /><ChevronRight size={16} className="text-[#89938b]" /></button>) : <div className="p-12 text-center"><Database className="mx-auto text-[#96a08d]" /><p className="mt-3 text-sm font-bold text-[#53635e]">No datasets yet.</p><p className="mt-1 text-xs text-[#849087]">Upload a labelled CSV to start the first training run.</p></div>}</div></SectionCard><div className="space-y-5"><SectionCard title="Training setup" eyebrow={selected ? selected.name : 'Select a dataset'}><div className="space-y-4 p-5">{selected ? <><label className="block text-xs font-bold text-[#53635e]">Target column<select value={target} onChange={(event) => setTarget(event.target.value)} className="mt-2 w-full rounded-lg border border-[#ced4c6] bg-[#fbfaf3] px-3 py-2.5 text-sm">{selected.columns.map((column) => <option key={column}>{column}</option>)}</select></label><label className="block text-xs font-bold text-[#53635e]">Task<select value={task} onChange={(event) => { const next = event.target.value as 'classification' | 'regression'; setTask(next); setAlgorithm(next === 'classification' ? 'random_forest' : 'random_forest_regressor'); }} className="mt-2 w-full rounded-lg border border-[#ced4c6] bg-[#fbfaf3] px-3 py-2.5 text-sm"><option value="classification">Classification</option><option value="regression">Regression</option></select></label><label className="block text-xs font-bold text-[#53635e]">Algorithm<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} className="mt-2 w-full rounded-lg border border-[#ced4c6] bg-[#fbfaf3] px-3 py-2.5 text-sm">{(task === 'classification' ? [['random_forest', 'Random Forest'], ['decision_tree', 'Decision Tree'], ['logistic_regression', 'Logistic Regression']] : [['random_forest_regressor', 'Random Forest'], ['decision_tree_regressor', 'Decision Tree'], ['linear_regression', 'Linear Regression']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button className="w-full" onClick={submitTraining} disabled={train.isPending || !target} testId="button-train-model">{train.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}{train.isPending ? 'Training…' : 'Train model'}</Button></> : <div className="py-10 text-center text-xs leading-5 text-[#849087]">Select a dataset to choose its target, task, and algorithm.</div>}</div></SectionCard><div className="rounded-xl border border-[#d5dcb9] bg-[#eaf1d4] p-5"><div className="flex items-center gap-2 text-[#527020]"><ShieldCheck size={17} /><span className="text-sm font-extrabold">Validation is part of recovery.</span></div><p className="mt-2 text-xs leading-5 text-[#6c7e50]">The backend checks CSV structure, imputes missing values, encodes categorical features, and stores the fitted pipeline as a versioned joblib artifact.</p></div></div></div></div>;
}

function SettingsPage() {
  const me = useGetCurrentUser();
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const user = me.data;
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (user) setName(user.full_name); }, [user?.full_name]);
  const save = () => { if (!name.trim()) return; update.mutate({ data: { full_name: name } }, { onSuccess: (updatedUser) => { qc.setQueryData(getGetCurrentUserQueryKey(), updatedUser); setSaved(true); window.setTimeout(() => setSaved(false), 2200); } }); };
  return <div className="fade-up"><PageHeader kicker="Settings / Workspace" title="Make the room yours." description="Profile settings are saved to SQLite. Notification switches are currently session-only display preferences." action={saved ? <span className="inline-flex items-center gap-2 rounded-lg bg-[#e5f1c6] px-3.5 py-2.5 text-sm font-bold text-[#527020]"><Check size={15} />Changes saved</span> : <Button onClick={save} disabled={update.isPending} testId="button-save-settings">Save changes</Button>} /><div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><SectionCard title="Profile" eyebrow="Your account"><div className="space-y-5 p-5"><div className="flex items-center gap-4 border-b border-[#e6e6dc] pb-5"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d9e3bc] text-lg font-extrabold text-[#294248]">{user?.full_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><p className="text-sm font-extrabold text-[#294248]">{user?.full_name}</p><p className="mt-1 text-xs text-[#7b877e]">{user?.email}</p></div></div><label className="block text-xs font-bold text-[#53635e]">Display name<input value={name || user?.full_name || ''} onChange={(event) => setName(event.target.value)} data-testid="input-display-name" className="mt-2 w-full rounded-lg border border-[#ced4c6] bg-[#fbfaf3] px-3 py-2.5 text-sm text-[#294248] outline-none focus:border-[#88a949] focus:ring-2 focus:ring-[#cfe19d]" /></label><p className="text-xs text-[#849087]">Email changes and password reset are not enabled because no email delivery provider is configured.</p></div></SectionCard><div className="space-y-5"><SectionCard title="Notifications" eyebrow="Signal, not noise"><div className="divide-y divide-[#e6e6dc] p-5"><SettingToggle title="Drift threshold alerts" detail="Notify when a feature crosses its watch budget." defaultOn /><SettingToggle title="Retraining completion" detail="Show a note when a candidate clears evaluation." defaultOn /><SettingToggle title="Deployment activity" detail="Keep an audit trail in the activity view." defaultOn={false} /></div></SectionCard><SectionCard title="Safety defaults" eyebrow="Deployment guardrails"><div className="space-y-3 p-5">{['Require quality gate before deploy', 'Keep last healthy version warm', 'Capture prediction payload samples'].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg bg-[#eff0e7] p-3"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#dceabc] text-[#5b7824]"><Check size={14} /></span><span className="text-xs font-bold text-[#53635e]">{item}</span><span className="ml-auto mono text-[10px] text-[#849087]">{index === 1 ? 'recommended' : 'on'}</span></div>)}</div></SectionCard></div></div></div>;
}

function SettingToggle({ title, detail, defaultOn }: { title: string; detail: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return <div className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"><div className="flex-1"><p className="text-sm font-bold text-[#53635e]">{title}</p><p className="mt-1 text-xs text-[#849087]">{detail}</p></div><button onClick={() => setOn((value) => !value)} data-testid={`button-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`} className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-[#82a831]' : 'bg-[#cfd5ca]')}><span className={cn('absolute top-1 h-4 w-4 rounded-full bg-[#f8f8f1] shadow-sm transition-transform', on ? 'translate-x-6' : 'translate-x-1')} /></button></div>;
}

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useLogin();
  const signup = useSignup();
  const qc = useQueryClient();
  const pending = login.isPending || signup.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const onSuccess = (user: User) => {
      qc.setQueryData(getGetCurrentUserQueryKey(), user);
    };
    const onError = (reason: unknown) => setError(reason instanceof Error ? reason.message : 'Authentication failed.');
    if (mode === 'login') login.mutate({ data: { email, password } }, { onSuccess, onError });
    else signup.mutate({ data: { full_name: name, email, password } }, { onSuccess, onError });
  };
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#192f34] px-4 py-10"><div className="w-full max-w-md rounded-2xl border border-[#345158] bg-[#203a40] p-7 text-[#eef0dd] shadow-2xl"><div className="flex items-center gap-3"><span className="relative flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#b9d967] text-[#192f34]"><span className="absolute h-3.5 w-3.5 rounded-full border-[2px] border-[#192f34]" /><span className="absolute h-1.5 w-1.5 rounded-full bg-[#192f34]" /></span><div><p className="text-sm font-extrabold">auto adapt</p><p className="eyebrow text-[9px] text-[#aab89e]">ml command center</p></div></div><h1 className="mt-10 text-3xl font-extrabold tracking-[-.04em]">{mode === 'login' ? 'Welcome back.' : 'Create your workspace.'}</h1><p className="mt-2 text-sm leading-6 text-[#aab89e]">{mode === 'login' ? 'Sign in to access your persisted datasets and model artifacts.' : 'Start with a private SQLite-backed workspace for your ML operations.'}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode === 'signup' && <label className="block text-xs font-bold text-[#d6e1cb]">Full name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="mt-2 w-full rounded-lg border border-[#456269] bg-[#192f34] px-3 py-3 text-sm text-[#eef0dd] outline-none focus:border-[#b9d967]" /></label>}<label className="block text-xs font-bold text-[#d6e1cb]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-lg border border-[#456269] bg-[#192f34] px-3 py-3 text-sm text-[#eef0dd] outline-none focus:border-[#b9d967]" /></label><label className="block text-xs font-bold text-[#d6e1cb]">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'signup' ? 10 : 1} className="mt-2 w-full rounded-lg border border-[#456269] bg-[#192f34] px-3 py-3 text-sm text-[#eef0dd] outline-none focus:border-[#b9d967]" />{mode === 'signup' && <span className="mt-1 block text-[11px] font-normal text-[#aab89e]">Use at least 10 characters.</span>}</label>{error && <div className="rounded-lg border border-[#8e5549] bg-[#4b302d] px-3 py-2 text-xs text-[#ffd4c9]">{error}</div>}<Button type="submit" className="w-full" disabled={pending}>{pending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}{pending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button></form><button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="mt-5 w-full text-center text-xs font-bold text-[#b9d967] hover:text-[#d4e89e]">{mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></div></div>;
}

function Router({ user }: { user: User }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><AppShell user={user}><Switch><Route path="/" component={DashboardPage} /><Route path="/models" component={ModelsPage} /><Route path="/monitoring" component={MonitoringPage} /><Route path="/retraining" component={RetrainingPage} /><Route path="/predictions" component={PredictionsPage} /><Route path="/activity" component={ActivityPage} /><Route path="/datasets" component={DatasetsPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></AppShell></ErrorBoundary>;
}

function AuthenticatedApp() {
  const userQuery = useGetCurrentUser();
  if (userQuery.isLoading) return <div className="min-h-[100dvh] bg-[#f1f0e8] p-8"><LoadingPanel label="Checking your session" /></div>;
  if (userQuery.isError || !userQuery.data) return <AuthPage />;
  return <Router user={userQuery.data} />;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthenticatedApp /></WouterRouter><Toaster /></QueryClientProvider>;
}

export default App;