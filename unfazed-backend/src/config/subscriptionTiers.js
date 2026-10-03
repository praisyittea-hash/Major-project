import { defaultEntitlements } from './features.js';
// Bootstrap configuration only. Existing database configuration always wins.
export const tierDefaults = [
  {
    key: 'default',
    name: 'Existing practice',
    features: {
      ...defaultEntitlements.features,
      clients_add: true,
      note_freeform: true,
      note_soap: true,
      note_dap: true,
      analytics_basic: true,
      analytics_advanced: false,
    },
    caps: defaultEntitlements.caps,
    pricePaise: null,
  },
  {
    key: 'starter',
    name: 'Starter',
    features: {
      ...defaultEntitlements.features,
      clients_add: true,
      note_freeform: true,
      note_soap: false,
      note_dap: false,
      analytics_basic: true,
      analytics_advanced: false,
    },
    caps: { clients: 10 },
    pricePaise: 0,
  },
  {
    key: 'professional',
    name: 'Professional',
    features: {
      ...defaultEntitlements.features,
      clients_add: true,
      note_freeform: true,
      note_soap: true,
      note_dap: true,
      analytics_basic: true,
      analytics_advanced: true,
    },
    caps: { clients: null },
    pricePaise: null,
  },
];
