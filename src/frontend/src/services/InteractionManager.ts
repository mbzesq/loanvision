/**
 * Core Interactive Framework for Dashboard Drill-Down Capabilities
 * Manages modal states, chart interactions, and cross-filtering
 */

export interface FilterState {
  status?: string;
  state?: string;
  investor?: string;
  dateRange?: { start: string; end: string };
  milestone?: string;
}

export interface NavigationState {
  breadcrumb: string[];
  filters: FilterState;
  currentView: string;
}

export interface ChartClickData {
  chartType: 'geographic' | 'pie-status' | 'foreclosure-bar' | 'cashflow-point' | 'kpi-card';
  dataPoint: any;
  context: any;
}

export interface ModalData {
  type: 'state-detail' | 'status-detail' | 'foreclosure-detail' | 'kpi-detail';
  title: string;
  data: any;
  actions?: ModalAction[];
}

export interface ModalAction {
  label: string;
  action: 'close' | 'navigate' | 'filter' | 'export';
  payload?: any;
}

class InteractionManager {
  private modalStack: HTMLElement[] = [];
  private filterState: FilterState = {};
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeModalContainer();
    this.setupEventListeners();
  }

  private initializeModalContainer() {
    // Create modal container if it doesn't exist
    if (!document.getElementById('modal-container')) {
      const container = document.createElement('div');
      container.id = 'modal-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
  }

  private setupEventListeners() {
    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalStack.length > 0) {
        this.closeTopModal();
      }
    });

    // Close modal on backdrop click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-overlay')) {
        this.closeTopModal();
      }
    });
  }

  // Event system for cross-component communication
  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public emit(event: string, data?: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => callback(data));
    }
  }

  public off(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Main chart interaction handler
  public handleChartClick(clickData: ChartClickData) {
    console.log('Chart clicked:', clickData);
    
    switch (clickData.chartType) {
      case 'geographic':
        this.handleGeographicClick(clickData.dataPoint, clickData.context);
        break;
      case 'pie-status':
        this.handleStatusClick(clickData.dataPoint, clickData.context);
        break;
      case 'foreclosure-bar':
        this.handleForeclosureClick(clickData.dataPoint, clickData.context);
        break;
      case 'cashflow-point':
        this.handleCashflowClick(clickData.dataPoint, clickData.context);
        break;
      case 'kpi-card':
        this.handleKPIClick(clickData.dataPoint, clickData.context);
        break;
    }
  }

  private handleGeographicClick(dataPoint: any, _context: any) {
    const modalData: ModalData = {
      type: 'state-detail',
      title: `${dataPoint.state} Portfolio Details`,
      data: {
        state: dataPoint.state,
        loanCount: dataPoint.loanCount,
        totalUPB: dataPoint.totalUPB,
        avgBalance: dataPoint.avgBalance,
        topCities: dataPoint.topCities || []
      },
      actions: [
        { label: 'Close', action: 'close' },
        { label: 'View All Loans', action: 'navigate', payload: { page: 'loans', filters: { state: dataPoint.state } } }
      ]
    };
    
    this.showModal(modalData);
  }

  private handleStatusClick(dataPoint: any, _context: any) {
    const modalData: ModalData = {
      type: 'status-detail',
      title: `${dataPoint.status} Loans`,
      data: {
        status: dataPoint.status,
        count: dataPoint.count,
        totalUPB: dataPoint.totalUPB,
        avgDaysInStatus: dataPoint.avgDaysInStatus,
        subCategories: dataPoint.subCategories || []
      },
      actions: [
        { label: 'Close', action: 'close' },
        { label: 'Filter Dashboard', action: 'filter', payload: { status: dataPoint.status } },
        { label: 'View Details', action: 'navigate', payload: { page: 'loans', filters: { status: dataPoint.status } } }
      ]
    };
    
    this.showModal(modalData);
  }

  private handleForeclosureClick(dataPoint: any, _context: any) {
    const modalData: ModalData = {
      type: 'foreclosure-detail',
      title: `${dataPoint.milestone} Foreclosure Details`,
      data: {
        milestone: dataPoint.milestone,
        count: dataPoint.count,
        avgDaysInMilestone: dataPoint.avgDaysInMilestone,
        nextActions: dataPoint.nextActions || [],
        urgentCases: dataPoint.urgentCases || []
      },
      actions: [
        { label: 'Close', action: 'close' },
        { label: 'View Loans', action: 'navigate', payload: { page: 'loans', filters: { milestone: dataPoint.milestone } } }
      ]
    };
    
    this.showModal(modalData);
  }

  private handleCashflowClick(dataPoint: any, _context: any) {
    // For cashflow points, show period details
    const modalData: ModalData = {
      type: 'kpi-detail',
      title: `${dataPoint.month} Cashflow Details`,
      data: {
        month: dataPoint.month,
        cashflow: dataPoint.cashflow,
        loanCount: dataPoint.loanCount,
        collections: dataPoint.collections,
        advances: dataPoint.advances
      },
      actions: [
        { label: 'Close', action: 'close' },
        { label: 'View Period Loans', action: 'navigate', payload: { page: 'loans', filters: { month: dataPoint.month } } }
      ]
    };
    
    this.showModal(modalData);
  }

  private handleKPIClick(dataPoint: any, _context: any) {
    const modalData: ModalData = {
      type: 'kpi-detail',
      title: `${dataPoint.title} Details`,
      data: {
        title: dataPoint.title,
        value: dataPoint.value,
        trend: dataPoint.trend,
        breakdown: dataPoint.breakdown || {},
        historicalData: dataPoint.historicalData || []
      },
      actions: [
        { label: 'Close', action: 'close' },
        { label: 'View Details', action: 'navigate', payload: { page: 'loans', filters: dataPoint.filters } }
      ]
    };
    
    this.showModal(modalData);
  }

  public showModal(modalData: ModalData) {
    const modalElement = this.createModalElement(modalData);
    const container = document.getElementById('modal-container')!;
    
    // Add to stack
    this.modalStack.push(modalElement);
    container.appendChild(modalElement);
    container.style.pointerEvents = 'auto';
    
    // Animate in
    requestAnimationFrame(() => {
      modalElement.style.opacity = '1';
      modalElement.style.transform = 'scale(1)';
    });

    // Emit modal opened event
    this.emit('modal-opened', modalData);
  }

  private createModalElement(modalData: ModalData): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.95);
      transition: all 200ms ease;
      z-index: 1001;
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    `;

    // Create modal content based on type
    modal.innerHTML = this.getModalContent(modalData);

    // Store action payloads in a Map to avoid JSON parsing issues
    const actionPayloads = new Map<string, any>();
    modalData.actions?.forEach((action, index) => {
      if (action.payload) {
        actionPayloads.set(`action-${index}`, action.payload);
      }
    });

    // Add event listeners for actions
    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const payloadKey = target.dataset.payloadKey;
      
      if (action) {
        e.preventDefault();
        const payload = payloadKey ? actionPayloads.get(payloadKey) : null;
        this.handleModalAction(action, payload);
      }
    });

    overlay.appendChild(modal);
    return overlay;
  }

  private getModalContent(modalData: ModalData): string {
    switch (modalData.type) {
      case 'state-detail':
        return this.getStateDetailContent(modalData);
      case 'status-detail':
        return this.getStatusDetailContent(modalData);
      case 'foreclosure-detail':
        return this.getForeclosureDetailContent(modalData);
      case 'kpi-detail':
        return this.getKPIDetailContent(modalData);
      default:
        return '<div class="modal-body">Unknown modal type</div>';
    }
  }

  private getStateDetailContent(modalData: ModalData): string {
    const { loanCount, totalUPB, avgBalance } = modalData.data;
    
    return `
      <div class="modal-header" style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">${modalData.title}</h2>
        <button class="close-btn" data-action="close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="state-metrics" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">${loanCount.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Total Loans</div>
          </div>
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">$${totalUPB.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Total UPB</div>
          </div>
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">$${avgBalance.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Avg Balance</div>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
        ${modalData.actions?.map((action, index) => `
          <button class="btn btn-${action.action === 'close' ? 'secondary' : 'primary'}" 
                  data-action="${action.action}"
                  data-payload-key="${action.payload ? `action-${index}` : ''}"
                  style="padding: 8px 16px; border-radius: 6px; font-weight: 500; border: none; cursor: pointer; ${action.action === 'close' ? 'background: #f3f4f6; color: #374151;' : 'background: #2563eb; color: white;'}">
            ${action.label}
          </button>
        `).join('') || ''}
      </div>
    `;
  }

  private getStatusDetailContent(modalData: ModalData): string {
    const { count, totalUPB, avgDaysInStatus } = modalData.data;
    
    return `
      <div class="modal-header" style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">${modalData.title}</h2>
        <span class="status-badge" style="display: inline-block; padding: 4px 8px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 12px; font-weight: 500;">${count} loans</span>
        <button class="close-btn" data-action="close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="status-metrics" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">${count.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Loan Count</div>
          </div>
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">$${totalUPB.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Total UPB</div>
          </div>
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">${avgDaysInStatus}</div>
            <div style="font-size: 14px; color: #6b7280;">Avg Days in Status</div>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
        ${modalData.actions?.map((action, index) => `
          <button class="btn btn-${action.action === 'close' ? 'secondary' : 'primary'}" 
                  data-action="${action.action}"
                  data-payload-key="${action.payload ? `action-${index}` : ''}"
                  style="padding: 8px 16px; border-radius: 6px; font-weight: 500; border: none; cursor: pointer; ${action.action === 'close' ? 'background: #f3f4f6; color: #374151;' : 'background: #2563eb; color: white;'}">
            ${action.label}
          </button>
        `).join('') || ''}
      </div>
    `;
  }

  private getForeclosureDetailContent(modalData: ModalData): string {
    const { milestone, count, avgDaysInMilestone } = modalData.data;
    
    return `
      <div class="modal-header" style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">${modalData.title}</h2>
        <button class="close-btn" data-action="close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="foreclosure-metrics" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">${count.toLocaleString()}</div>
            <div style="font-size: 14px; color: #6b7280;">Loans in ${milestone}</div>
          </div>
          <div class="metric-card" style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 4px;">${avgDaysInMilestone}</div>
            <div style="font-size: 14px; color: #6b7280;">Avg Days in Milestone</div>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
        ${modalData.actions?.map((action, index) => `
          <button class="btn btn-${action.action === 'close' ? 'secondary' : 'primary'}" 
                  data-action="${action.action}"
                  data-payload-key="${action.payload ? `action-${index}` : ''}"
                  style="padding: 8px 16px; border-radius: 6px; font-weight: 500; border: none; cursor: pointer; ${action.action === 'close' ? 'background: #f3f4f6; color: #374151;' : 'background: #2563eb; color: white;'}">
            ${action.label}
          </button>
        `).join('') || ''}
      </div>
    `;
  }

  private getKPIDetailContent(modalData: ModalData): string {
    const { value, trend } = modalData.data;
    
    return `
      <div class="modal-header" style="padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">${modalData.title}</h2>
        <button class="close-btn" data-action="close" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div class="kpi-detail" style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; font-weight: 700; color: #111827; margin-bottom: 8px;">${value}</div>
          ${trend ? `<div style="font-size: 14px; color: ${trend.direction === 'up' ? '#059669' : '#dc2626'};">
            ${trend.direction === 'up' ? '↑' : '↓'} ${trend.value}% vs ${trend.period}
          </div>` : ''}
        </div>
      </div>
      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
        ${modalData.actions?.map((action, index) => `
          <button class="btn btn-${action.action === 'close' ? 'secondary' : 'primary'}" 
                  data-action="${action.action}"
                  data-payload-key="${action.payload ? `action-${index}` : ''}"
                  style="padding: 8px 16px; border-radius: 6px; font-weight: 500; border: none; cursor: pointer; ${action.action === 'close' ? 'background: #f3f4f6; color: #374151;' : 'background: #2563eb; color: white;'}">
            ${action.label}
          </button>
        `).join('') || ''}
      </div>
    `;
  }

  private handleModalAction(action: string, payload?: any) {
    switch (action) {
      case 'close':
        this.closeTopModal();
        break;
      case 'navigate':
        this.navigateToPage(payload);
        break;
      case 'filter':
        this.applyFilter(payload);
        break;
      case 'export':
        this.exportData(payload);
        break;
    }
  }

  private closeTopModal() {
    if (this.modalStack.length === 0) return;
    
    const modal = this.modalStack.pop()!;
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      modal.remove();
      if (this.modalStack.length === 0) {
        const container = document.getElementById('modal-container')!;
        container.style.pointerEvents = 'none';
      }
    }, 200);

    this.emit('modal-closed');
  }

  private navigateToPage(payload: any) {
    this.closeTopModal();
    const { page, filters } = payload;
    
    // Build query string from filters
    const queryString = Object.entries(filters || {})
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const url = queryString ? `/${page}?${queryString}` : `/${page}`;
    window.location.href = url;
  }

  private applyFilter(filters: FilterState) {
    this.filterState = { ...this.filterState, ...filters };
    this.emit('filters-changed', this.filterState);
    this.closeTopModal();
  }

  private exportData(payload: any) {
    console.log('Export data:', payload);
    // Implement export functionality
  }

  // Filter management
  public getFilters(): FilterState {
    return { ...this.filterState };
  }

  public clearFilters() {
    this.filterState = {};
    this.emit('filters-changed', this.filterState);
  }

  public setFilter(key: keyof FilterState, value: any) {
    (this.filterState as any)[key] = value;
    this.emit('filters-changed', this.filterState);
  }
}

// Export singleton instance
export const interactionManager = new InteractionManager();
export default interactionManager;