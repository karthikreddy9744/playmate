import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { FiSearch, FiEdit2, FiTrash2, FiArrowLeft, FiX, FiClock, FiUsers, FiMapPin, FiDollarSign } from 'react-icons/fi';

interface Game {
  id: number; sport: string; skillLevel: string; startTime: string;
  durationMinutes: number; totalSlots: number; availableSlots: number;
  costPerPerson: number; locationName: string; locationAddress: string;
  hostName: string; status: string; notes: string; createdAt: string;
  createdBy?: number;
}


const SPORT_OPTIONS = ['ALL', 'BADMINTON', 'FOOTBALL', 'CRICKET', 'TENNIS', 'BASKETBALL', 'TABLE_TENNIS', 'VOLLEYBALL', 'SWIMMING', 'RUNNING', 'CYCLING', 'YOGA', 'GYM', 'OTHER'];
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const ViewGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('ALL');
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editForm, setEditForm] = useState({ sport: '', skillLevel: '', startTime: '', durationMinutes: 60, totalSlots: 10, costPerPerson: 0, locationName: '', locationAddress: '', notes: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => { fetchGames(); }, []);
  const fetchGames = async () => { try { const r = await api.get('/admin/games'); setGames(r.data); } catch (e) { console.error(e); toast.error('Failed to load games'); } finally { setLoading(false); } };

  const handleEdit = (g: Game) => {
    setEditingGame(g);
    setEditForm({ sport: g.sport || '', skillLevel: g.skillLevel || '', startTime: g.startTime || '', durationMinutes: g.durationMinutes || 60, totalSlots: g.totalSlots || 10, costPerPerson: g.costPerPerson || 0, locationName: g.locationName || '', locationAddress: g.locationAddress || '', notes: g.notes || '' });
  };
  const handleSave = async () => { if (!editingGame) return; try { await api.patch(`/admin/games/${editingGame.id}`, editForm); toast.success('Game updated'); setEditingGame(null); fetchGames(); } catch (e: any) { console.error(e); toast.error(e.response?.data?.error || 'Failed to update game'); } };
  const handleDelete = async (id: number) => { try { await api.delete(`/admin/games/${id}`); setGames(games.filter(g => g.id !== id)); setDeleteConfirm(null); toast.success('Game deleted'); } catch (e) { console.error(e); toast.error('Failed to delete game'); } };

  const filtered = games.filter(g => {
    const s = searchTerm.toLowerCase();
    const match = g.sport?.toLowerCase().includes(s) || g.locationName?.toLowerCase().includes(s) || g.hostName?.toLowerCase().includes(s);
    return match && (sportFilter === 'ALL' || g.sport === sportFilter);
  });

  const fmt = (d: string) => { if (!d) return '-'; try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return d; } };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface"><div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-surface py-10 px-4">
      <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading">View Games</h1>
            <p className="text-textSecondary text-sm">{games.length} total games</p>
          </div>
          <Link to="/admin" className="btn-secondary flex items-center gap-1.5 text-sm"><FiArrowLeft className="w-4 h-4" /> Back to Dashboard</Link>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="glass-card-solid p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by sport, location, or host..." className="input-field !pl-10" />
          </div>
          <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="select-field md:w-44">
            {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Sports' : s.replace('_', ' ')}</option>)}
          </select>
        </motion.div>

        {/* Edit Modal */}
        {editingGame && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingGame(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card-solid p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-textPrimary">Edit Game</h3><button onClick={() => setEditingGame(null)}><FiX className="w-5 h-5 text-textSecondary" /></button></div>
              <div className="space-y-3">
                <div><label className="text-xs text-textSecondary mb-1 block">Sport</label><select value={editForm.sport} onChange={e => setEditForm({ ...editForm, sport: e.target.value })} className="select-field text-sm">{SPORT_OPTIONS.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
                <div><label className="text-xs text-textSecondary mb-1 block">Skill Level</label><select value={editForm.skillLevel} onChange={e => setEditForm({ ...editForm, skillLevel: e.target.value })} className="select-field text-sm">{['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS', 'MIXED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
                <div><label className="text-xs text-textSecondary mb-1 block">Start Time</label><input type="datetime-local" value={editForm.startTime ? editForm.startTime.slice(0, 16) : ''} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })} className="input-field text-sm" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-textSecondary mb-1 block">Duration (min)</label><input type="number" value={editForm.durationMinutes} onChange={e => setEditForm({ ...editForm, durationMinutes: +e.target.value || 0 })} className="input-field text-sm" /></div>
                  <div><label className="text-xs text-textSecondary mb-1 block">Total Slots</label><input type="number" value={editForm.totalSlots} onChange={e => setEditForm({ ...editForm, totalSlots: +e.target.value || 0 })} className="input-field text-sm" /></div>
                </div>
                <div><label className="text-xs text-textSecondary mb-1 block">Cost per Person</label><input type="number" value={editForm.costPerPerson} onChange={e => setEditForm({ ...editForm, costPerPerson: +e.target.value || 0 })} className="input-field text-sm" /></div>
                <div><label className="text-xs text-textSecondary mb-1 block">Location Name</label><input value={editForm.locationName} onChange={e => setEditForm({ ...editForm, locationName: e.target.value })} className="input-field text-sm" /></div>
                <div><label className="text-xs text-textSecondary mb-1 block">Location Address</label><input value={editForm.locationAddress} onChange={e => setEditForm({ ...editForm, locationAddress: e.target.value })} className="input-field text-sm" /></div>
                <div><label className="text-xs text-textSecondary mb-1 block">Notes</label><textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="input-field text-sm resize-none" /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                <button onClick={() => setEditingGame(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card-solid p-7 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-textPrimary mb-2">Confirm Delete</h3>
              <p className="text-sm text-textSecondary mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-medium hover:bg-danger/20 transition-colors">Delete</button>
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <motion.div variants={fadeUp} className="glass-card-solid text-center py-14">
            <p className="text-textSecondary">No games found{searchTerm || sportFilter !== 'ALL' ? ' matching your filters' : ''}.</p>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(g => (
              <motion.div key={g.id} variants={fadeUp} className="glass-card-solid p-5 flex flex-col justify-between card-hover">
                <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="chip chip-active text-xs">{g.sport?.replace('_', ' ')}</span>
                      <span className="text-xs text-textSecondary">#{g.id}</span>
                    </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-textSecondary"><FiClock className="w-3.5 h-3.5" /><span>{fmt(g.startTime)}</span></div>
                    <div className="flex items-center gap-2 text-textSecondary"><FiUsers className="w-3.5 h-3.5" /><span>{g.availableSlots}/{g.totalSlots} slots &middot; {g.durationMinutes} min</span></div>
                    {g.locationName && <div className="flex items-center gap-2 text-textSecondary"><FiMapPin className="w-3.5 h-3.5" /><span className="truncate">{g.locationName}</span></div>}
                    <div className="flex items-center gap-2 text-textSecondary"><FiDollarSign className="w-3.5 h-3.5" /><span>{g.costPerPerson > 0 ? `₹${g.costPerPerson}` : 'Free'}</span></div>
                    {g.hostName && <p className="text-xs text-textSecondary pt-1">Host: <span className="text-textPrimary font-medium">{g.hostName}</span></p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleEdit(g)} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1.5"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => setDeleteConfirm(g.id)} className="py-2 px-3 bg-danger/10 text-danger rounded-xl text-sm font-medium hover:bg-danger/20 transition-colors flex items-center justify-center gap-1.5"><FiTrash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ViewGames;
