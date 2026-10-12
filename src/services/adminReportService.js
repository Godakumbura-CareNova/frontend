import { doctorPaymentApi } from '../api/doctorPaymentApi';
import pharmacyApi from '../api/pharmacyApi';
import { appointmentApi } from '../api/appointmentApi';
import { validUtcTimestamp } from '../utils/validUtcTimestamp';

const DAY = 86400000;
const OFFSET = 330 * 60000;
const options = { timeout: 15000 };
const integer = n => Number.isSafeInteger(n) && n >= 0;
const positiveId = n => integer(n) && n > 0;
const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const invalid = () => new Error('Report information is unavailable or changed while loading. Please retry.');
const dateKey = millis => new Date(millis).toISOString().slice(0, 10);
const localDay = value => dateKey(Date.parse(value) + OFFSET);
const meta = data => object(data) && data.currency === 'LKR' && data.timeZone === 'Asia/Colombo' &&
  integer(data.undatedSuccessfulCount) && validUtcTimestamp(data.generatedAtUtc);

export function reportingPeriod(kind, date) {
  if (!['daily', 'weekly', 'monthly'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid reporting date.');
  const [year, month, day] = date.split('-').map(Number);
  let start = Date.UTC(year, month - 1, day);
  if (year < 2000 || year > 2100 || dateKey(start) !== date) throw new Error('Choose a valid reporting date between 2000 and 2100.');
  if (kind === 'weekly') start -= ((new Date(start).getUTCDay() + 6) % 7) * DAY;
  if (kind === 'monthly') start = Date.UTC(year, month - 1, 1);
  const end = kind === 'monthly' ? Date.UTC(year, month, 1) : start + (kind === 'weekly' ? 7 : 1) * DAY;
  const dates = Array.from({ length: Math.round((end - start) / DAY) }, (_, i) => dateKey(start + i * DAY));
  return { from: new Date(start - OFFSET).toISOString(), to: new Date(end - OFFSET).toISOString(), dates,
    label: dates.length === 1 ? dates[0] : `${dates[0]} to ${dates.at(-1)}` };
}

export async function loadMedicineReport(period) {
  const records = []; let expectedCount; let pages = 1; let undatedSuccessfulCount = 0;
  for (let page = 1; page <= pages; page++) {
    const response = await doctorPaymentApi.get('/api/admin/reports/medicine-payments', { ...options, params: { from: period.from, to: period.to, page, pageSize: 100 } });
    const data = response.data;
    if (response.status !== 200 || !meta(data) || !integer(data.totalCount) || data.page !== page || data.pageSize !== 100 ||
      data.totalPages !== Math.ceil(data.totalCount / 100) || !Array.isArray(data.items) ||
      data.items.length !== Math.min(100, Math.max(0, data.totalCount - (page - 1) * 100)) ||
      (expectedCount !== undefined && expectedCount !== data.totalCount) || data.items.some(p => !object(p) || !positiveId(p.id) ||
        !positiveId(p.orderId) || typeof p.patientId !== 'string' || !p.patientId || !amount(p.amount) || !validUtcTimestamp(p.confirmedAtUtc) ||
        Date.parse(p.confirmedAtUtc) < Date.parse(period.from) || Date.parse(p.confirmedAtUtc) >= Date.parse(period.to))) throw invalid();
    expectedCount = data.totalCount; pages = data.totalPages; undatedSuccessfulCount = Math.max(undatedSuccessfulCount, data.undatedSuccessfulCount);
    records.push(...data.items);
  }
  if (new Set(records.map(p => p.id)).size !== records.length || new Set(records.map(p => p.orderId)).size !== records.length) throw invalid();
  const costs = new Map();
  for (let offset = 0; offset < records.length; offset += 100) {
    const ids = records.slice(offset, offset + 100).map(p => p.orderId);
    const params = new URLSearchParams(); ids.forEach(id => params.append('orderIds', id));
    const response = await pharmacyApi.get('/admin/reports/medicine-costs', { ...options, params });
    if (response.status !== 200 || !Array.isArray(response.data) || response.data.length > ids.length || response.data.some(c =>
      !object(c) || !ids.includes(c.orderId) || typeof c.customerId !== 'string' || !amount(c.totalAmount) || !(c.buyingCost === null || amount(c.buyingCost))) ||
      new Set(response.data.map(c => c.orderId)).size !== response.data.length) throw invalid();
    response.data.forEach(c => costs.set(c.orderId, c));
  }
  const days = period.dates.map(date => ({ date, income: 0, buyingCost: 0, missingCostCount: 0 }));
  const byDate = new Map(days.map(day => [day.date, day]));
  for (const payment of records) {
    const day = byDate.get(localDay(payment.confirmedAtUtc)); if (!day) throw invalid();
    day.income += payment.amount;
    const cost = costs.get(payment.orderId);
    if (!cost || cost.buyingCost === null || cost.customerId.toLowerCase() !== payment.patientId.toLowerCase() || Math.abs(cost.totalAmount - payment.amount) > 0.005)
      day.missingCostCount++;
    else day.buyingCost += cost.buyingCost;
  }
  const income = round(days.reduce((sum, d) => sum + d.income, 0));
  const buyingCost = round(days.reduce((sum, d) => sum + d.buyingCost, 0));
  const missingCostCount = days.reduce((sum, d) => sum + d.missingCostCount, 0);
  return { income, buyingCost, profit: missingCostCount ? null : round(income - buyingCost), missingCostCount, undatedSuccessfulCount,
    days: days.map(day => ({ ...day, income: round(day.income), buyingCost: round(day.buyingCost), profit: day.missingCostCount ? null : round(day.income - day.buyingCost) })) };
}

export async function loadAppointmentReport(period) {
  const response = await appointmentApi.get('/api/admin/reports/appointment-income', { ...options, params: { from: period.from, to: period.to } });
  const data = response.data;
  if (response.status !== 200 || !meta(data) || !Array.isArray(data.days) || data.days.length > period.dates.length ||
    data.days.some(day => !object(day) || !period.dates.includes(day.date) || !amount(day.amount) || !integer(day.count)) ||
    new Set(data.days.map(day => day.date)).size !== data.days.length) throw invalid();
  const days = period.dates.map(date => data.days.find(day => day.date === date) ?? { date, amount: 0, count: 0 });
  return { income: round(days.reduce((sum, day) => sum + day.amount, 0)), count: days.reduce((sum, day) => sum + day.count, 0),
    undatedSuccessfulCount: data.undatedSuccessfulCount, days };
}
