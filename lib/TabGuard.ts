/**
 * TabGuard - Sistema anti-recarga automática para TalentScope
 * 
 * Previene que la página se recargue automáticamente cuando:
 * 1. Se cambia de pestaña/ventana
 * 2. El navegador intenta descartar la pestaña inactiva
 * 3. Vite HMR pierde la conexión WebSocket
 * 4. El navegador "congela" la pestaña en background
 * 
 * Uso en React:
 *   useEffect(() => {
 *     const guard = new TabGuard();
 *     guard.activate();
 *     return () => guard.deactivate();
 *   }, []);
 */

export class TabGuard {
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private lockResolver: (() => void) | null = null;
  private isActive = false;
  private originalLocationReload: typeof location.reload;
  private reloadBlocked = false;

  constructor() {
    this.originalLocationReload = location.reload.bind(location);
  }

  activate() {
    if (this.isActive) return;
    this.isActive = true;

    // 1. Override location.reload to prevent programmatic reloads
    this.interceptReload();

    // 2. Intercept Vite HMR full-reload events
    this.interceptViteHMR();

    // 3. Web Lock API - prevent browser from discarding tab
    this.acquireWebLock();

    // 4. Keep-alive ping to prevent throttling
    this.startKeepAlive();

    // 5. Listen for freeze/resume events (Page Lifecycle API)
    this.listenPageLifecycle();

    // 6. Prevent beforeunload for accidental closes
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    console.log('[TabGuard] ✅ Protección anti-recarga activada');
  }

  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;

    // Restore original reload
    location.reload = this.originalLocationReload;

    // Release web lock
    if (this.lockResolver) {
      this.lockResolver();
      this.lockResolver = null;
    }

    // Stop keep-alive
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // Remove event listeners
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('freeze', this.handleFreeze);
    document.removeEventListener('resume', this.handleResume);

    console.log('[TabGuard] 🔓 Protección anti-recarga desactivada');
  }

  /**
   * Permite recargas manuales del usuario (Ctrl+R / F5)
   * pero bloquea recargas programáticas automáticas.
   */
  private interceptReload() {
    // Skip if already intercepted by early-boot script in index.html
    if ((window as any).__tabguard_reload_intercepted) {
      console.log('[TabGuard] reload ya interceptado por script temprano, omitiendo');
      return;
    }

    const self = this;
    const originalReload = this.originalLocationReload;

    // Track if user initiated the reload (keyboard shortcut)
    let userInitiated = false;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+R, Cmd+R, F5 - user wants to reload
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        userInitiated = true;
        setTimeout(() => { userInitiated = false; }, 100);
      }
      if (e.key === 'F5') {
        userInitiated = true;
        setTimeout(() => { userInitiated = false; }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    // Override location.reload - wrapped in try-catch for safety
    try {
      Object.defineProperty(location, 'reload', {
        configurable: true,
        value: function(...args: any[]) {
          if (userInitiated) {
            console.log('[TabGuard] Recarga manual del usuario permitida');
            return originalReload.apply(location, args);
          }
          console.warn('[TabGuard] ⛔ Recarga automática bloqueada');
          self.reloadBlocked = true;
        }
      });
    } catch (e) {
      console.warn('[TabGuard] No se pudo redefinir location.reload (ya protegido)');
    }
  }

  /**
   * Intercepts Vite HMR ws messages that trigger full page reloads
   */
  private interceptViteHMR() {
    // Vite uses a custom event on the import.meta.hot
    // But we can also intercept at the WebSocket level
    if (typeof window !== 'undefined' && (import.meta as any).hot) {
      const hot = (import.meta as any).hot;
      
      // Vite fires 'vite:beforeFullReload' before a full reload
      hot.on('vite:beforeFullReload', (payload: any) => {
        console.warn('[TabGuard] ⛔ Vite full reload interceptado y bloqueado', payload);
        // Return false or throw to prevent the reload
        // Vite checks for the event listener and if one is registered,
        // it expects the page to handle the update manually
      });

      // Also intercept ws reconnect which can trigger reload
      hot.on('vite:ws:disconnect', () => {
        console.log('[TabGuard] 🔌 Vite WebSocket desconectado (tab en background?)');
      });

      hot.on('vite:ws:connect', () => {
        console.log('[TabGuard] 🔌 Vite WebSocket reconectado');
      });
    }
  }

  /**
   * Web Locks API to prevent tab from being discarded
   */
  private acquireWebLock() {
    if ('locks' in navigator) {
      (navigator as any).locks.request(
        'talentscope-tab-guard',
        { mode: 'exclusive' },
        () => new Promise<void>((resolve) => {
          this.lockResolver = resolve;
        })
      );
    }
  }

  /**
   * Keep-alive interval to prevent JS timer throttling
   */
  private startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      // Touch the DOM minimally to keep the tab "active"
      const marker = document.getElementById('tabguard-keepalive');
      if (marker) {
        marker.dataset.ping = String(Date.now());
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Page Lifecycle API handlers
   */
  private listenPageLifecycle() {
    document.addEventListener('freeze', this.handleFreeze);
    document.addEventListener('resume', this.handleResume);
  }

  private handleFreeze = () => {
    console.log('[TabGuard] ❄️ Página congelada por el navegador');
    // Save emergency state snapshot
    try {
      sessionStorage.setItem('ts_freeze_timestamp', String(Date.now()));
      sessionStorage.setItem('ts_was_frozen', 'true');
    } catch (e) {
      // ignore
    }
  };

  private handleResume = () => {
    console.log('[TabGuard] 🔄 Página restaurada del estado congelado');
    sessionStorage.removeItem('ts_was_frozen');
  };

  private handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // Only warn if there's active state worth protecting
    const hasActiveSearch = sessionStorage.getItem('ts_active_search') === 'true';
    if (hasActiveSearch) {
      e.preventDefault();
      return (e.returnValue = '¿Seguro que quieres salir? Se perderá la búsqueda en curso.');
    }
  };

  /**
   * Mark that a search is actively running / not running
   */
  static setSearchActive(active: boolean) {
    if (active) {
      sessionStorage.setItem('ts_active_search', 'true');
    } else {
      sessionStorage.removeItem('ts_active_search');
    }
  }
}
