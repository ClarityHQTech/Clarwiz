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
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
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
              className={`border-t border-gray-100 hover:bg-gray-50 ${
                selectedTenantId === tenant.id ? "bg-cyan-50/70" : ""
              }`}
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onSelectTenant?.(tenant)}
                >
                  <div className="font-medium text-gray-900">{tenant.name}</div>
                  <div className="text-xs text-gray-500">
                    Created: {new Date(tenant.createdAt).toLocaleDateString()}
                  </div>
                </button>
              </td>
              <td className="px-4 py-3 text-gray-700">{tenant.memberCount}</td>
              <td className="px-4 py-3 text-gray-700">{tenant.campaignCount}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    tenant.payment_status
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
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
                    className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
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
                className="px-4 py-8 text-center text-sm text-gray-500"
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
