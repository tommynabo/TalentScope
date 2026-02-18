/**
 * TabGuard - Sistema anti-descarte de pestaña para TalentScope
 * 
 * Previene que el navegador descarte/congele la pestaña cuando:
 * 1. Se cambia de pestaña/ventana
 * 2. El navegador intenta descartar la pestaña inactiva
 * 3. El navegador "congela" la pestaña en background
 * 
 * NO toca location.reload (eso causaba errores).
 * Solo usa APIs seguras: Web Locks, keep-alive, Page Lifecycle.
 */

export class TabGuard {
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private lockResolver: (() => void) | null = null;
  private isActive = false;

  activate() {
    if (this.isActive) return;
    this.isActive = true;

    // 1. Web Lock API - prevent browser from discarding tab
    this.acquireWebLock();

    // 2. Keep-alive ping to prevent throttling
    this.startKeepAlive();

    // 3. Listen for freeze/resume events (Page Lifecycle API)
    this.listenPageLifecycle();

    // 4. Prevent beforeunload for accidental closes during search
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    console.log('[TabGuard] ✅ Protección anti-descarte activada');
  }

  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;

    if (this.lockResolver) {
      this.lockResolver();
      this.lockResolver = null;
    }

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener('freeze', this.handleFreeze);
    document.removeEventListener('resume', this.handleResume);

    console.log('[TabGuard] 🔓 Protección desactivada');
  }

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

  private startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      const marker = document.getElementById('tabguard-keepalive');
      if (marker) {
        marker.dataset.ping = String(Date.now());
      }
    }, 10000);
  }

  private listenPageLifecycle() {
    document.addEventListener('freeze', this.handleFreeze);
    document.addEventListener('resume', this.handleResume);
  }

  private handleFreeze = () => {
    console.log('[TabGuard] ❄️ Página congelada por el navegador');
    try {
      sessionStorage.setItem('ts_freeze_timestamp', String(Date.now()));
      sessionStorage.setItem('ts_was_frozen', 'true');
    } catch (e) { /* ignore */ }
  };

  private handleResume = () => {
    console.log('[TabGuard] 🔄 Página restaurada');
    sessionStorage.removeItem('ts_was_frozen');
  };

  private handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const hasActiveSearch = sessionStorage.getItem('ts_active_search') === 'true';
    if (hasActiveSearch) {
      e.preventDefault();
      return (e.returnValue = '¿Seguro que quieres salir? Se perderá la búsqueda en curso.');
    }
  };

  /**
   * Signal that a search is active (can't close/reload tab safely)
   */
  static setSearchActive(active: boolean) {
    if (active) {
      sessionStorage.setItem('ts_active_search', 'true');
    } else {
      sessionStorage.removeItem('ts_active_search');
    }
  }

  /**
   * Get current search status
   */
  static isSearchActive(): boolean {
    return sessionStorage.getItem('ts_active_search') === 'true';
  }
}
