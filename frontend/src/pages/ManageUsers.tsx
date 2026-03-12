import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FiSearch, FiEdit2, FiTrash2, FiArrowLeft, FiX } from 'react-icons/fi';

interface User {
  id: number; name: string; email: string; role: string;
  isActive: boolean; locationCity: string; totalGamesPlayed: number;
  averageRating: number; createdAt: string; lastLogin: string; phone?: string;
}

const ManageUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', locationCity: '', phone: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => { fetchUsers(); }, []);
  const fetchUsers = async () => { try { const r = await api.get('/admin/users'); setUsers(r.data); } catch (e) { console.error(e); } finally { setLoading(false); } };

 const handleEdit = (u: User) => { setEditingUser(u); setEditForm({ name: u.name || '', email: u.email || '', role: u.role || 'user', locationCity: u.locationCity || '', phone: u.phone || '' }); };
  const handleSave = async () => { if (!editingUser) return; try { await api.patch(`/admin/users/${editingUser.id}`, editForm); toast.success('User updated'); setEditingUser(null); fetchUsers(); } catch (e: any) { console.error(e); toast.error(e.response?.data?.error || 'Failed to update user'); } };
  const handleDelete = async (id: number) => { try { await api.delete(`/admin/users/${id}`); setUsers(users.filter(u => u.id !== id)); setDeleteConfirm(null); } catch (e) { console.error(e); } };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.locationCity?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface"><div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading">Manage Users</h1>
            <p className="text-textSecondary text-sm">{users.length} registered users</p>
          </div>
          <Link to="/admin" className="btn-secondary flex items-center gap-1.5 text-sm"><FiArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        </div>

        {/* Search */}
        <div className="glass-card-solid p-4">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name, email, or city..."
              className="input-field !pl-10" />
          </div>
        </div>

        {/* Modal: Edit */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card-solid p-7 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-textPrimary">Edit User</h3><button onClick={() => setEditingUser(null)}><FiX className="w-5 h-5 text-textSecondary" /></button></div>
              <div className="space-y-3">
                {(['name', 'email', 'locationCity', 'phone'] as const).map(f => (
                  <div key={f}>
                    <label className="text-xs text-textSecondary mb-1 block capitalize">{f === 'locationCity' ? 'City' : f === 'phone' ? 'Phone' : f}</label>
                    <input type={f === 'email' ? 'email' : 'text'} value={(editForm as any)[f]} onChange={e => setEditForm({ ...editForm, [f]: e.target.value })} className="input-field text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-textSecondary mb-1 block">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="select-field text-sm">
                    <option value="user">User</option><option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                <button onClick={() => setEditingUser(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Delete */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card-solid p-7 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-textPrimary mb-2">Confirm Delete</h3>
              <p className="text-sm text-textSecondary mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-medium hover:bg-danger/20 transition-colors">Delete</button>
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Table */}
        <div className="glass-card-solid overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider">Email</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider hidden lg:table-cell">Phone</th>

                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider">Role</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider hidden lg:table-cell">City</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider hidden lg:table-cell">Games</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider hidden lg:table-cell">Rating</th>
                  <th className="p-4 text-xs font-medium text-textSecondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-surface transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent font-bold text-xs shrink-0">{u.name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <span className="text-sm font-medium text-textPrimary">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-textSecondary">{u.email}</td>
                    <td className="p-4 text-sm text-textSecondary hidden lg:table-cell">{u.phone || '-'}</td>

                    <td className="p-4"><span className={`chip text-xs ${u.role === 'admin' ? 'chip-active' : ''}`}>{u.role}</span></td>
                    <td className="p-4 text-sm text-textSecondary hidden lg:table-cell">{u.locationCity || '-'}</td>
                    <td className="p-4 text-sm text-textPrimary hidden lg:table-cell">{u.totalGamesPlayed || 0}</td>
                    <td className="p-4 text-sm text-textPrimary hidden lg:table-cell">{u.averageRating ? Number(u.averageRating).toFixed(1) : '-'}</td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleEdit(u)} className="p-2 rounded-lg hover:bg-accent/10 text-textSecondary hover:text-accent transition-colors"><FiEdit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm(u.id)} className="p-2 rounded-lg hover:bg-danger/10 text-textSecondary hover:text-danger transition-colors"><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-14"><p className="text-textSecondary">No users found{searchTerm ? ' matching your search' : ''}.</p></div>}
        </div>
      </motion.div>
    </div>
  );
};

export default ManageUsers;
