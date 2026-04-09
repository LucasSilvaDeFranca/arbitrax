'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, getToken, logout } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';

const ROLE_LABELS: Record<string, string> = {
  USUARIO: 'Usuario',
  ADVOGADO: 'Advogado',
  ARBITRO: 'Arbitro',
  ADMIN: 'Administrador',
};

const ROLE_COLORS: Record<string, string> = {
  USUARIO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ADVOGADO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ARBITRO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  separator?: boolean;
}

function getNavItems(role: string): NavItem[] {
  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  ];

  switch (role) {
    case 'USUARIO':
      items.push(
        { href: '/arbitragens', label: 'Meus Casos', icon: '⚖' },
        { href: '/arbitragens/nova', label: 'Nova Arbitragem', icon: '➕' },
      );
      break;
    case 'ADVOGADO':
      items.push(
        { href: '/arbitragens', label: 'Casos dos Clientes', icon: '⚖' },
        { href: '/arbitragens/nova', label: 'Nova Arb. para Cliente', icon: '➕' },
      );
      break;
    case 'ARBITRO':
      items.push(
        { href: '/arbitragens', label: 'Arbitragens', icon: '⚖' },
        { href: '/arbitro', label: 'Meus Casos', icon: '⚖' },
      );
      break;
    case 'ADMIN':
      items.push(
        { href: '/arbitragens', label: 'Arbitragens', icon: '⚖' },
        { href: '/arbitragens/nova', label: 'Nova Arbitragem', icon: '➕' },
      );
      break;
    default:
      items.push(
        { href: '/arbitragens', label: 'Arbitragens', icon: '⚖' },
      );
      break;
  }

  items.push(
    { href: '/notificacoes', label: 'Notificacoes', icon: '🔔' },
    { href: '/certificado-digital', label: 'Assinatura Digital', icon: '🔐' },
  );

  if (role === 'ARBITRO') {
    items.push({ href: '', label: '', icon: '', separator: true });
  }

  if (role === 'ADMIN') {
    items.push(
      { href: '/admin', label: 'Painel Admin', icon: '🛡' },
      { href: '/admin/audit', label: 'Audit Log', icon: '📋' },
    );
  }

  return items;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  if (!user) return null;

  const filteredNav = getNavItems(user.role);

  const initials = user.nome
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '??';

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-lg rounded-lg p-2 dark:bg-slate-800 dark:border dark:border-slate-700"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 dark:bg-[#0f172a] dark:border-slate-800 z-40 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
              <span className="text-2xl font-bold text-primary-700 dark:text-white">ArbitraX</span>
            </Link>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">A justica do futuro, hoje!</p>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 dark:text-slate-100 truncate">{user.nome}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-2">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 dark:bg-slate-700 dark:text-slate-200'}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {filteredNav.map((item, idx) => {
                if (item.separator) {
                  return (
                    <li key={`sep-${idx}`} className="my-2">
                      <hr className="border-gray-200 dark:border-slate-700" />
                    </li>
                  );
                }
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Bottom actions */}
          <div className="p-3 border-t border-gray-100 dark:border-slate-800">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === '/settings'
                  ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-lg">⚙</span>
              Configuracoes
            </Link>
            <ThemeToggle />
            <button
              onClick={() => { logout(); setIsOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition w-full"
            >
              <span className="text-lg">🚪</span>
              Sair da conta
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
