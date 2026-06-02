import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Package } from 'lucide-react';
import api from '../api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', description: '', price: '', stock: '' });

  const fetchProducts = () => {
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    api.getProducts(params).then(setProducts).catch(console.error);
  };

  useEffect(() => { fetchProducts(); }, [search, category]);
  useEffect(() => { api.getProductCategories().then(setCategories).catch(() => {}); }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ name: '', category: '', description: '', price: '', stock: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({ name: p.name, category: p.category, description: p.description || '', price: String(p.price), stock: String(p.stock) });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, category: form.category, description: form.description, price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0 };
    try {
      if (editingProduct) await api.updateProduct(editingProduct.id, payload);
      else await api.createProduct(payload);
      setShowModal(false);
      fetchProducts();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.deleteProduct(id);
    fetchProducts();
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Products</h2>
          <p className="text-mute-dark text-sm mt-0.5">{products.length} products in catalog</p>
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mute-dark" />
          <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
            className="glass-input pl-10" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="glass-input w-auto min-w-[160px] cursor-pointer">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Product</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Category</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Price (ZMW)</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Stock</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-mute-dark uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-sm text-white">{p.name}</div>
                    <div className="text-xs text-mute-dark truncate max-w-xs mt-0.5">{p.description}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-mute border border-white/[0.04]">{p.category}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-sm text-white">K {p.price?.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`text-sm font-bold ${p.stock < 5 ? 'text-red-400' : p.stock < 15 ? 'text-brand' : 'text-green-400'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-2 text-mute-dark hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-mute-dark hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-16 text-center">
                  <Package className="w-8 h-8 text-mute-dark mx-auto mb-2 opacity-50" />
                  <p className="text-mute-dark text-sm">No products found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="glass-panel w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white text-lg">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/[0.05] rounded-lg text-mute-dark"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">Product Name *</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">Category</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Filters" list="catlist" className="glass-input" />
                <datalist id="catlist">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="glass-input resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">Price (ZMW)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="glass-input" /></div>
                <div><label className="block text-xs font-semibold text-mute mb-1.5 ml-1 uppercase tracking-wider">Stock</label><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="glass-input" /></div>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="submit" className="btn-primary flex-1">{editingProduct ? 'Save Changes' : 'Create Product'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
