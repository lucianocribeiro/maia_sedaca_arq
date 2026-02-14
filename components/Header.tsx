'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const links = [
  { href: '/#obras', label: 'Obras y Proyectos' },
  { href: '/#detalles', label: 'Detalles' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#contacto', label: 'Contacto' },
  { href: '/login', label: 'Login' }
];

export function Header() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (hamburgerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="logo-container">
            <Link href="/" onClick={() => setOpen(false)}>
              <img src="/MaiaSedacaLogo.png" alt="Maia Sedaca Logo" />
            </Link>
          </div>

          <button
            type="button"
            className="hamburger"
            ref={hamburgerRef}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <nav
        className={`nav-overlay ${open ? 'active' : ''}`}
        id="navMenu"
        aria-hidden={!open}
        ref={menuRef}
      >
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
