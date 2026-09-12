import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { medicineApi } from '../api/medicineApi';
import { inventoryApi } from '../api/inventoryApi';
import './medicineManagement.css';

const empty = { medicineId: '', batchNumber: '', quantity: '', purchasePrice: '', sellingPrice: '', manufacturingDate: '', expiryDate: '' };
const dateValue = (value) => value ? value.slice(0, 10) : '';

export default function InventoryManagementPage() {
  const [form, setForm] = useState(empty);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [low, setLow] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [medicineResponse, inventoryResponse] = await Promise.all([medicineApi.list(), inventoryApi.list(low)]);
      setMedicines(medicineResponse.data.filter((medicine) => medicine.isActive));
      setInventory(inventoryResponse.data);
    } catch {
      setError('Unable to load inventory.');
    }
  };

  useEffect(() => { load(); }, [low]);

  const clearForm = () => { setForm(empty); setEditingBatchId(null); };
  const showBatches = async (item) => {
    try {
      const response = await inventoryApi.batches(item.medicineId);
      setSelectedMedicine(item);
      setBatches(response.data);
    } catch {
      setError('Unable to load stock batches.');
    }
  };
  const editBatch = (batch) => {
    setEditingBatchId(batch.id);
    setForm({ ...batch, medicineId: String(batch.medicineId), quantity: String(batch.quantity), purchasePrice: String(batch.purchasePrice), sellingPrice: String(batch.sellingPrice), manufacturingDate: dateValue(batch.manufacturingDate), expiryDate: dateValue(batch.expiryDate) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const updating = Boolean(editingBatchId);
    try {
      const payload = { ...form, medicineId: Number(form.medicineId), quantity: Number(form.quantity), purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice) };
      if (updating) await inventoryApi.updateBatch(editingBatchId, payload);
      else await inventoryApi.createBatch(payload);
      const updatedMedicine = inventory.find((item) => item.medicineId === payload.medicineId) || { medicineId: payload.medicineId, medicineName: medicines.find((item) => item.id === payload.medicineId)?.name };
      clearForm();
      setMessage(updating ? 'Stock batch updated successfully.' : 'Stock batch saved successfully.');
      await load();
      if (selectedMedicine?.medicineId === payload.medicineId) await showBatches(updatedMedicine);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save stock batch.');
    }
  };

  return <DashboardLayout><section className="management-page">
    <div className="management-heading"><h1>Inventory Management</h1><p>Manage medicine batches and low-stock levels.</p></div>
    {error && <div className="management-alert error">{error}</div>}
    {message && <div className="management-alert success">{message}</div>}
    <div className="management-grid">
      <form className="management-card medicine-form" onSubmit={submit}>
        <h2>{editingBatchId ? 'Edit stock batch' : 'Add stock batch'}</h2>
        <label>Medicine<select required disabled={Boolean(editingBatchId)} value={form.medicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })}><option value="">Select medicine</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select></label>
        <label>Batch number<input required value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}/></label>
        <label>Quantity<input required min="0" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></label>
        <label>Purchase price<input required min="0" type="number" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })}/></label>
        <label>Selling price<input required min="0" type="number" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}/></label>
        <label>Manufacturing date<input required type="date" value={form.manufacturingDate} onChange={(event) => setForm({ ...form, manufacturingDate: event.target.value })}/></label>
        <label>Expiry date<input required type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}/></label>
        <div className="management-actions"><button className="primary-action">{editingBatchId ? 'Save changes' : 'Save stock batch'}</button>{editingBatchId && <button type="button" className="secondary-action" onClick={clearForm}>Cancel</button>}</div>
      </form>
      <div className="management-card"><h2>Medicine inventory</h2><label className="check-label"><input type="checkbox" checked={low} onChange={(event) => setLow(event.target.checked)}/> Low stock only</label>{inventory.map((item) => <div className="list-row" key={item.medicineId}><div><strong>{item.medicineName}</strong><span>{item.totalQuantity} units · {item.availabilityStatus}</span></div><div className="row-actions"><button onClick={() => showBatches(item)}>View batches</button></div></div>)}</div>
    </div>
    {selectedMedicine && <div className="management-card inventory-batches"><h2>{selectedMedicine.medicineName} batches</h2>{batches.length === 0 ? <p>No stock batches yet.</p> : batches.map((batch) => <div className="list-row" key={batch.id}><div><strong>{batch.batchNumber}</strong><span>{batch.quantity} units · Expires {dateValue(batch.expiryDate)}</span></div><div className="row-actions"><button onClick={() => editBatch(batch)}>Edit</button></div></div>)}</div>}
  </section></DashboardLayout>;
}
