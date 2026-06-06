"use client";

const TenantTable = ({
  tenants = [],
  onSelectTenant,
  selectedTenantId,
  actionLabel,
  onAction,
  actionLoadingId,
}) => {
  return (
    <div className="rounded-lg border border-brand-secondary/30 bg-brand-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-brand-bg text-brand-stone">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Tenant</th>
            <th className="px-4 py-3 text-left font-medium">Members</th>
            <th className="px-4 py-3 text-left font-medium">Campaigns</th>
            <th className="px-4 py-3 text-left font-medium">Payment</th>
            {actionLabel ? (
              <th className="px-4 py-3 text-right font-medium">Action</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className={`border-t border-brand-secondary/15 hover:bg-brand-bg ${
                selectedTenantId === tenant.id ? "bg-brand-sage/15" : ""
              }`}
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onSelectTenant?.(tenant)}
                >
                  <div className="font-medium text-brand-ink">{tenant.name}</div>
                  <div className="text-xs text-brand-stone">
                    Created: {new Date(tenant.createdAt).toLocaleDateString()}
                  </div>
                </button>
              </td>
              <td className="px-4 py-3 text-brand-stone">{tenant.memberCount}</td>
              <td className="px-4 py-3 text-brand-stone">{tenant.campaignCount}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    tenant.payment_status
                      ? "bg-green-100 text-green-700"
                      : "bg-brand-bg text-brand-stone"
                  }`}
                >
                  {tenant.payment_status ? "True" : "False"}
                </span>
              </td>
              {actionLabel ? (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onAction?.(tenant)}
                    disabled={actionLoadingId === tenant.id}
                    className="rounded-md bg-brand-dark px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    {actionLoadingId === tenant.id ? "Please wait..." : actionLabel}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {tenants.length === 0 ? (
            <tr>
              <td
                colSpan={actionLabel ? 5 : 4}
                className="px-4 py-8 text-center text-sm text-brand-stone"
              >
                No tenants found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

export default TenantTable;
