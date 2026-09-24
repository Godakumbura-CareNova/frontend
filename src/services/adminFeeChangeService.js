import { doctorPaymentApi } from "../api/doctorPaymentApi.js";

/** Doctors' fee-change requests for admin review. `status` is Pending, Approved, Rejected or All. */
export const listFeeChangeRequests = async (status = "Pending") => {
  const response = await doctorPaymentApi.get("/api/admin/fee-change-requests", { params: { status } });
  return response.data;
};

/** Approves a pending request: the doctor's fee changes and they are notified. A request already reviewed rejects with a 409. */
export const approveFeeChangeRequest = async (requestId) => {
  const response = await doctorPaymentApi.post(`/api/admin/fee-change-requests/${encodeURIComponent(requestId)}/approve`);
  return response.data;
};

/** Rejects a pending request with a reason the doctor will see. A missing reason rejects with a 400. */
export const rejectFeeChangeRequest = async (requestId, reason) => {
  const response = await doctorPaymentApi.post(`/api/admin/fee-change-requests/${encodeURIComponent(requestId)}/reject`, { reason });
  return response.data;
};
