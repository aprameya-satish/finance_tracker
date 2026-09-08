import { NavLink, Outlet } from 'react-router-dom'

const links = [
  ['/', 'Overview'],
  ['/transactions', 'Activity'],
  ['/review', 'Review'],
  ['/budgets', 'Budgets'],
  ['/reports', 'Split'],
  ['/accounts', 'Accounts'],
  ['/investments', 'Investments'],
  ['/settings', 'Settings'],
] as const

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-52 shrink-0 border-r border-[var(--border)] px-5 py-8">
        <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] mb-8">Finance</div>
        <nav className="flex flex-col gap-1">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[var(--surface-2)] text-white' : 'text-[var(--muted)] hover:text-white'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-10 py-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  )
}
