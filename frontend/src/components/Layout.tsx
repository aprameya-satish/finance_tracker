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

const primary = [
  ['/', 'Overview'],
  ['/transactions', 'Activity'],
  ['/budgets', 'Budgets'],
  ['/reports', 'Split'],
  ['/accounts', 'Accounts'],
] as const

export default function Layout() {
  return (
    <div className="min-h-screen md:flex bg-[var(--bg)]">
      <aside className="hidden md:block w-52 shrink-0 border-r border-[var(--border)] px-5 py-8">
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
      <main className="flex-1 px-4 pt-4 pb-24 md:px-10 md:py-8 md:pb-8 max-w-7xl w-full mx-auto">
        <div className="md:hidden flex gap-4 text-sm text-[var(--muted)] mb-4">
          <NavLink to="/review" className={({ isActive }) => (isActive ? 'text-white' : '')}>
            Review
          </NavLink>
          <NavLink to="/investments" className={({ isActive }) => (isActive ? 'text-white' : '')}>
            Investments
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'text-white' : '')}>
            Settings
          </NavLink>
        </div>
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-[var(--border)] bg-[var(--bg)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-5">
        {primary.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `text-center text-[11px] py-2 ${isActive ? 'text-white' : 'text-[var(--muted)]'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
