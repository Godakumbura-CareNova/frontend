import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/home/PublicLayout';
export default function PublicNotFoundPage() { return <PublicLayout><section className="dashboard-section"><h1>Page not found</h1><p>This link is unavailable. Use the navigation or return to the home page.</p><Link className="btn btn-primary" to="/">Back to home</Link></section></PublicLayout>; }
