"use client";

import { setFeeStatusAction } from "@/app/admin/fees/actions";

/** Changes a fee's status the moment it is chosen — three states don't fit the usual publish/archive toggle. */
export function FeeStatusSelect({ id, status, returnTo }: { id: string; status: string; returnTo: string }) {
  return (
    <form action={setFeeStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <select
        name="status" defaultValue={status} className="select h-9 py-1 text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Fee status"
      >
        <option value="PENDING">Pending</option>
        <option value="PAID">Paid</option>
        <option value="WAIVED">Waived</option>
      </select>
    </form>
  );
}
