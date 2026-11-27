// Mock data for platform-admin
export const mockData = {
  tenants: [
    {
      id: "tenant-alpha",
      name: "Alpha Tenant",
      createdAt: "2023-01-01T00:00:00Z",
      status: "active",
      enabledModules: 5,
      plan: "growth",
    },
    {
      id: "tenant-beta",
      name: "Beta Tenant",
      createdAt: "2023-02-15T00:00:00Z",
      status: "active",
      enabledModules: 9,
      plan: "scale",
    },
    {
      id: "tenant-gamma",
      name: "Gamma Tenant",
      createdAt: "2023-03-10T00:00:00Z",
      status: "active",
      enabledModules: 10,
      plan: "enterprise",
    },
    {
      id: "tenant-beta-suspended",
      name: "Beta Suspended",
      createdAt: "2023-04-01T00:00:00Z",
      status: "suspended",
      enabledModules: 9,
      plan: "scale",
    },
  ],
  tenantStore: {
    useTenants: () => mockData.tenants,
  },
};