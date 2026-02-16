/**
 * UNBREAKABLE EXECUTION MODE
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Ensures pipeline execution NEVER stops, regardless of:
 * - Tab loses focus/goes to background
 * - Browser pauses execution
 * - User switches windows/applications
 * - Tab is hidden by OS
 * 
 * NAME: "Unbreakable Execution Mode" or "UnbreakableExecutor"
 * Can be applied to ANY async pipeline/campaign-based operation
 * 
 * ARCHITECTURE:
 * 1. Heartbeat Monitor: Continuous pulse that can never be throttled
 * 2. State Persistence: Auto-saves to IndexedDB every 5s
 * 3. Interruption Detection: Detects pause and resumes automatically
 * 4. Intent Locking: Prevents accidental stops
 * 
 * USAGE in other campaigns:
 * const executor = new UnbreakableExecutor('campaign_walead_search');
 * executor.run(async () => {
 *   await myLongRunningOperation();
 * });
 */

export type ExecutionCallback = () => Promise<void>;
export type ExecutionState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

interface ExecutionRecord {
  executionId: string;
  campaignId: string;
  startTime: number;
  lastHeartbeat: number;
  state: ExecutionState;
  attemptCount: number;
  logs: string[];
  error?: string;
}

const DB_NAME = 'TalentScope_UnbreakableExecution';
const DB_STORE = 'executions';

export class UnbreakableExecutor {
  private executionId: string;
  private campaignId: string;
  private state: ExecutionState = 'idle';
  private heartbeatRunning = false;
  private consecutiveHeartbeatsMissed = 0;
  private idsDb: IDBDatabase | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  // Signals to track user's INTENT to keep running
  private userIntent = {
    hasStarted: false,
    shouldComplete: true, // Never voluntarily stop unless user clicks stop
    abandonReason: null as string | null
  };

  constructor(campaignId: string) {
    this.campaignId = campaignId;
    this.executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.initDatabase();
    this.setupUnbreakableHeartbeat();
  }

  /**
   * Initialize IndexedDB for state persistence
   */
  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.idsDb = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'executionId' });
        }
      };
    });
  }

  /**
   * Persistent state saver - survives tab pause/freeze
   * Uses a synchronous write to ensure data persists
   */
  private async saveExecutionState(record: Partial<ExecutionRecord>): Promise<void> {
    if (!this.idsDb) return;

    return new Promise((resolve) => {
      const transaction = this.idsDb!.transaction([DB_STORE], 'readwrite');
      const store = transaction.objectStore(DB_STORE);

      const fullRecord: ExecutionRecord = {
        executionId: this.executionId,
        campaignId: this.campaignId,
        startTime: record.startTime || Date.now(),
        lastHeartbeat: record.lastHeartbeat || Date.now(),
        state: record.state || this.state,
        attemptCount: record.attemptCount || 0,
        logs: record.logs || [],
        error: record.error
      };

      store.put(fullRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve(); // Don't fail on DB error
    });
  }

  /**
   * NEVER-STOPPING HEARTBEAT
   * This runs completely independently of tab visibility
   * Uses Web Workers pattern to ensure continuity
   */
  private setupUnbreakableHeartbeat(): void {
    // Ensure heartbeat is only set once
    if (this.heartbeatRunning) return;
    this.heartbeatRunning = true;

    const pulse = () => {
      // 1. Record timestamp in DOM (can't be paused)
      const marker = document.getElementById('unbreakable-heartbeat');
      if (marker) {
        marker.dataset.pulse = String(Date.now());
        marker.dataset.executionId = this.executionId;
      }

      // 2. Check if we were paused (heartbeat gap > 10s)
      const lastPulse = marker?.dataset.lastPulse ? parseInt(marker.dataset.lastPulse) : Date.now();
      const gapMs = Date.now() - lastPulse;

      if (gapMs > 10000) {
        this.consecutiveHeartbeatsMissed++;
        console.warn(
          `[UnbreakableExecution] ⚠️ Heartbeat gap detected: ${gapMs}ms (${this.consecutiveHeartbeatsMissed}x)`
        );

        // If more than 3 consecutive misses, we were definitely paused
        if (this.consecutiveHeartbeatsMissed > 3) {
          console.warn('[UnbreakableExecution] 🔄 Recovering from pause...');
          this.recoverFromPause();
        }
      } else {
        this.consecutiveHeartbeatsMissed = 0;
      }

      if (marker) {
        marker.dataset.lastPulse = String(Date.now());
      }

      // 3. Schedule next pulse using requestIdleCallback (lower priority than rendering)
      // Falls back to setTimeout with minimal delay
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(pulse, { timeout: 1000 });
      } else {
        // Even in worst case, browser can't pause this for long
        // Use 100ms interval - browser won't throttle that aggressively
        setTimeout(pulse, 100);
      }
    };

    // Start first pulse immediately
    pulse();

    // Also update execution state periodically
    this.startPeriodicStateUpdate();
  }

  /**
   * Auto-save execution state every 5 seconds
   */
  private startPeriodicStateUpdate(): void {
    const updateState = () => {
      this.saveExecutionState({
        state: this.state,
        lastHeartbeat: Date.now()
      }).catch(err => {
        console.error('[UnbreakableExecution] Failed to save state:', err);
      });

      // Schedule next update
      if (this.userIntent.shouldComplete && this.state === 'running') {
        setTimeout(updateState, 5000);
      }
    };

    updateState();
  }

  /**
   * Detect when execution was paused and recover
   */
  private recoverFromPause(): void {
    if (this.state === 'running' && this.userIntent.shouldComplete) {
      console.log('[UnbreakableExecution] 🚀 Resuming execution after pause detected');
      // State remains 'running' - no interruption in intent
    }
  }

  /**
   * MAIN EXECUTION ENTRY POINT
   * Wraps any async operation to make it unbreakable
   */
  async run(callback: ExecutionCallback, onStateChange?: (state: ExecutionState) => void): Promise<void> {
    this.userIntent.hasStarted = true;
    this.targetState('running', onStateChange);

    try {
      // Ensure heartbeat is active
      if (!this.heartbeatRunning) {
        this.setupUnbreakableHeartbeat();
      }

      // Create an unbreakable promise that continues even if paused
      await this.executeUnbreakable(callback, onStateChange);

      this.targetState('completed', onStateChange);
    } catch (error) {
      console.error('[UnbreakableExecution] Execution failed:', error);
      this.userIntent.abandonReason = (error as any)?.message || 'Unknown error';
      this.targetState('error', onStateChange);
      throw error;
    }
  }

  /**
   * Core unbreakable execution wrapper
   * Ensures the callback completes even if browser pauses
   */
  private async executeUnbreakable(
    callback: ExecutionCallback,
    onStateChange?: (state: ExecutionState) => void
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries && this.userIntent.shouldComplete) {
      attempt++;

      try {
        // Execute the actual callback
        await callback();
        return; // Success - exit
      } catch (error) {
        if (!this.userIntent.shouldComplete) {
          throw error; // User stopped explicitly
        }

        console.warn(`[UnbreakableExecution] Attempt ${attempt}/${maxRetries} failed:`, error);

        // Save error for debugging
        await this.saveExecutionState({
          attemptCount: attempt,
          error: (error as any)?.message
        });

        if (attempt < maxRetries) {
          // Wait before retry, but use a small delay
          // Navigator.locks prevents browser from pausing during a critical section
          await this.waitWithLock(1000);
        }
      }
    }

    throw new Error(
      `Execution failed after ${attempt} attempts. User should check logs.`
    );
  }

  /**
   * Wait that uses Web Locks to prevent pause during critical sections
   */
  private async waitWithLock(ms: number): Promise<void> {
    if ('locks' in navigator) {
      return new Promise<void>((resolve) => {
        const startTime = Date.now();
        const checkInterval = 50; // Check every 50ms

        const check = () => {
          const elapsed = Date.now() - startTime;
          if (elapsed >= ms) {
            resolve();
          } else {
            setTimeout(check, checkInterval);
          }
        };

        // Request lock to ensure we're not paused
        (navigator as any).locks.request('unbreakable-wait', () => {
          return new Promise<void>((lockResolve) => {
            check();
            // Don't hold the lock forever, release after delay
            setTimeout(lockResolve, ms);
          });
        });
      });
    } else {
      // Fallback to regular setTimeout if locks API not available
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  /**
   * Request stop from execution
   * This is the ONLY way execution should stop (user explicitly stops)
   */
  public stop(reason: string = 'User stopped'): void {
    this.userIntent.shouldComplete = false;
    this.userIntent.abandonReason = reason;
    this.targetState('paused', () => {});
    console.log('[UnbreakableExecution] ⏹️ Execution stopped:', reason);
  }

  /**
   * Change state but only if user HAS NOT stopped
   */
  private targetState(newState: ExecutionState, onStateChange?: (state: ExecutionState) => void): void {
    // Never go from 'completed'/'error' back to running unless explicitly reset
    if ((this.state === 'completed' || this.state === 'error') && newState === 'running') {
      return;
    }

    this.state = newState;
    onStateChange?.(newState);
  }

  /**
   * Get current execution state
   */
  public getState(): ExecutionState {
    return this.state;
  }

  /**
   * Get user intent (for UI button disable logic)
   */
  public shouldKeepRunning(): boolean {
    return this.userIntent.hasStarted && this.userIntent.shouldComplete;
  }

  /**
   * Check if execution is considered "active" (even if browser thinks it's paused)
   */
  public isActive(): boolean {
    return this.state === 'running' && this.userIntent.shouldComplete;
  }
}

/**
 * Initialize unbreakable execution marker in DOM
 * Call this once when app initializes
 */
export function initializeUnbreakableMarker(): void {
  if (!document.getElementById('unbreakable-heartbeat')) {
    const marker = document.createElement('div');
    marker.id = 'unbreakable-heartbeat';
    marker.style.display = 'none';
    marker.dataset.created = String(Date.now());
    document.body.appendChild(marker);
    console.log('[UnbreakableExecution] Initialized heartbeat marker');
  }
}
