import { useSignal } from '@preact/signals';
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Drawer, DrawerToggle, Menu, MenuItem, Navbar, ThemeController, isDrawerDocked } from '@shared/components/ui';
import { CalendarDays, CalendarX, Clock, LogOut, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from '@shared/components/ui/icons';
import { ADMIN_ROUTE_TITLES, toAdminHash, type AdminRoute } from '@shared/utils/adminRoute';
import { saveAdminMode } from '@shared/utils/adminThemePreference';

const SIDE_ID = 'admin-navigation';
const APP_TITLE = 'Maximum Bookings Admin';

const NAV_ITEMS: Array<{ route: AdminRoute; label: string; icon: ComponentChildren }> = [
  { route: 'bookings', label: 'Bookings', icon: <CalendarDays /> },
  { route: 'settings/general', label: 'General', icon: <SlidersHorizontal /> },
  { route: 'settings/opening-hours', label: 'Opening Hours', icon: <Clock /> },
  { route: 'settings/blocked-dates', label: 'Blocked Dates', icon: <CalendarX /> },
];

/** The specific-day view belongs to Opening Hours, so that item stays current there. */
const isCurrent = (item: AdminRoute, route: AdminRoute) =>
  item === route || (item === 'settings/opening-hours' && route === 'settings/opening-hours/specific-day');

type AdminLayoutProps = {
  venueName: string;
  route: AdminRoute;
  onLogout: () => void;
  children: ComponentChildren;
};

/**
 * The admin shell: a drawer docked from lg up (collapsible to icons) and an overlay below that, a navbar with the venue
 * and page title, and the page in `<main id="main-content">`. The drawer starts closed and its state is not stored.
 */
const AdminLayout: FunctionComponent<AdminLayoutProps> = ({ venueName, route, onLogout, children }) => {
  const open = useSignal(false);
  const mainRef = useRef<HTMLElement>(null);
  const title = ADMIN_ROUTE_TITLES[route];

  useEffect(() => {
    document.title = `${title} - ${APP_TITLE}`;
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);

  // Below lg, following a link closes the overlay. The panel then becomes hidden, so focus moves to the page rather than
  // dropping to <body>.
  function onNavigate() {
    if (isDrawerDocked() || !open.value) return;
    open.value = false;
    requestAnimationFrame(() => mainRef.current?.focus());
  }

  return (
    <Drawer
      sideId={SIDE_ID}
      open={open.value}
      onOpenChange={(next) => {
        open.value = next;
      }}
      side={
        <>
          <nav aria-label="Admin" class="grow">
            <Menu class="w-full">
              {NAV_ITEMS.map((item) => (
                <MenuItem
                  key={item.route}
                  label={item.label}
                  icon={item.icon}
                  href={toAdminHash(item.route)}
                  active={isCurrent(item.route, route)}
                  tooltip
                  onClick={onNavigate}
                />
              ))}
            </Menu>
          </nav>
          <Menu class="w-full">
            <li>
              <ThemeController lightTheme="admin-light" darkTheme="admin-dark" onChange={(_theme, mode) => saveAdminMode(mode)} />
            </li>
            <MenuItem label="Sign out" icon={<LogOut />} tooltip onClick={onLogout} />
          </Menu>
        </>
      }
    >
      <div class="flex min-h-screen flex-col">
        <Navbar
          class="bg-base-100 border-base-300 gap-2 border-b px-4"
          start={
            <div class="flex items-center gap-3">
              <DrawerToggle label="Navigation" on={<PanelLeftClose />} off={<PanelLeftOpen />} />
              <div>
                <span id="venue-name" class="text-base-content/70 block text-sm">
                  {venueName}
                </span>
                <h1 class="m-0 text-xl">{title}</h1>
              </div>
            </div>
          }
        />
        <main id="main-content" ref={mainRef} tabIndex={-1} class="grid grow content-start gap-4 p-6 outline-none">
          {children}
        </main>
      </div>
    </Drawer>
  );
};

export default AdminLayout;
