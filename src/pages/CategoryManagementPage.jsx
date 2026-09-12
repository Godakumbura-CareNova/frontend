import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { categoryApi } from '../api/categoryApi';
import './medicineManagement.css';

const CategoryManagementPage = () => {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => { try { setCategories((await categoryApi.list()).data); } catch { setError('Unable to load categories. Please retry.'); } };
  useEffect(() => { load(); }, []);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    try { editing ? await categoryApi.update(editing, { name }) : await categoryApi.create({ name }); setName(''); setEditing(null); setMessage('Category saved successfully.'); load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save category.'); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try { await categoryApi.remove(id); setMessage('Category deleted.'); load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete category.'); }
  };
  return <DashboardLayout><section className="management-page"><div className="management-heading"><div><h1>Medicine Categories</h1><p>Organise medicines for the catalogue.</p></div></div>{error && <div className="management-alert error">{error}</div>}{message && <div className="management-alert success">{message}</div>}<div className="management-grid"><form className="management-card" onSubmit={submit}><h2>{editing ? 'Edit category' : 'Add category'}</h2><label>Category name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Pain Relief" required minLength="2" maxLength="80" /></label><div className="management-actions"><button className="primary-action">{editing ? 'Save changes' : 'Add category'}</button>{editing && <button type="button" className="secondary-action" onClick={() => { setEditing(null); setName(''); }}>Cancel</button>}</div></form><div className="management-card"><h2>Categories</h2>{categories.length === 0 ? <p className="empty-state">No categories yet.</p> : <div className="management-list">{categories.map((category) => <div className="list-row" key={category.id}><div><strong>{category.name}</strong><span>{category.medicineCount} medicines</span></div><div className="row-actions"><button onClick={() => { setEditing(category.id); setName(category.name); }}>Edit</button><button className="danger-link" onClick={() => remove(category.id)}>Delete</button></div></div>)}</div>}</div></div></section></DashboardLayout>;
};
export default CategoryManagementPage;
