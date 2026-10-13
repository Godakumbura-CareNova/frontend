export const time = '2026-10-12T10:00:00Z';
export const users = { totalUsers: 10, patients: 6, pharmacyStaff: 2, doctors: 1, generatedAtUtc: time };
export const operations = { totalOrders: 7, orderStatusCounts: { Pending: 7 }, recentOrders: [{ id: 1, reference: 'CN-1', orderDate: time, status: 'Pending', totalAmount: 100 }],
  lowStock: { totalCount: 1, items: [{ medicineId: 2, medicineName: 'Low medicine', quantity: 0, threshold: 10 }] }, generatedAtUtc: time };
export const appointments = { totalAppointments: 2, statusCounts: { Booked: 2 }, todayCount: 1, upcomingCount: 1,
  recentAppointments: [{ id: 1, reference: 'APT-1', doctorName: 'Dr Test', startUtc: time, status: 'Booked', paymentMethod: null, paymentStatus: null }], generatedAtUtc: time };
export const payments = amount => ({ totalPayments: 1, statusCounts: { Successful: 1 }, pendingTransfers: { totalCount: 0, items: [] }, recentPayments: [],
  income: { todayAmount: amount, monthAmount: amount, undatedSuccessfulCount: 0, undatedSuccessfulAmount: 0, currency: 'LKR', timeZone: 'Asia/Colombo', asOfUtc: time }, generatedAtUtc: time });
