const labels = {
  clients_add: 'More active clients',
  note_soap: 'SOAP note templates',
  note_dap: 'DAP note templates',
  note_freeform: 'Clinical notes',
  analytics_advanced: 'Advanced analytics',
  analytics_basic: 'Analytics',
  crm: 'Client management',
  payments: 'Billing',
  scheduling: 'Scheduling',
  packages: 'Session packages',
};
export const entitlementFailure = (error) =>
  error.response?.data?.code === 'ENTITLEMENT_REQUIRED' ? error.response.data : null;
export default function UpgradePrompt({ feature, onDismiss }) {
  return (
    <aside className="card" role="alert">
      <h3>{labels[feature] || 'This feature'} requires subscription access</h3>
      <p>
        This feature is unavailable for your current subscription or its capacity has been reached.
        Your current work is preserved.
      </p>
      <div className="row">
        <a className="button" href="/subscription" target="_blank" rel="noreferrer">
          Review upgrade options
        </a>
        {onDismiss && (
          <button className="secondary" onClick={onDismiss}>
            Keep working
          </button>
        )}
      </div>
    </aside>
  );
}
